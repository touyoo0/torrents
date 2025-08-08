import logging
from datetime import timedelta
import json
import pymysql
import shutil
import os
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import Variable
from airflow.utils.dates import days_ago
from airflow.exceptions import AirflowSkipException

logger = logging.getLogger("torrents_delete")

default_args = {
    "owner": "airflow",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
}


def get_db_variables():
    """Récupère la variable TORRENTS_DATABASE depuis Airflow"""
    try:
        db = Variable.get("TORRENTS_DATABASE")
        logger.info("Variable DB récupérée avec succès")
        return db
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise


def A_retrieve_params(**kwargs):
    """Récupère les paramètres du dag_run (torrent_id et user optionnel) et la config DB"""
    ti = kwargs['ti']

    dag_run = kwargs.get('dag_run')
    if not dag_run:
        raise AirflowSkipException("dag_run est None")
    if not hasattr(dag_run, 'conf') or not dag_run.conf:
        raise AirflowSkipException("Aucune configuration fournie")

    try:
        torrent_id = dag_run.conf.get('torrent_id')
        user = dag_run.conf.get('user')  # optionnel, juste à titre de log
        if not torrent_id:
            raise AirflowSkipException("Aucun ID de torrent fourni")
    except Exception as e:
        raise AirflowSkipException(f"Erreur paramètres: {str(e)}")

    db = get_db_variables()

    ti.xcom_push(key='db', value=db)
    ti.xcom_push(key='torrent_id', value=torrent_id)
    if user:
        ti.xcom_push(key='user', value=user)

    logger.info(f"Paramètres: torrent_id={torrent_id}, user={user}")
    return True


def B_fetch_repertoire(**kwargs):
    """Récupère le chemin 'repertoire' en DB pour le torrent."""
    ti = kwargs['ti']
    db = json.loads(ti.xcom_pull(key='db'))
    torrent_id = ti.xcom_pull(key='torrent_id')

    conn = pymysql.connect(
        host=db["DB_HOST"],
        user=db["DB_USER"],
        password=db["DB_PASSWORD"],
        db=db["DB_NAME"],
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT repertoire FROM ygg_torrents_new WHERE id = %s LIMIT 1", (torrent_id,))
            row = cursor.fetchone()
            repertoire = row[0] if row and len(row) > 0 else None
            ti.xcom_push(key='repertoire', value=repertoire)
            logger.info(f"Repertoire DB pour id={torrent_id}: {repertoire}")
    finally:
        conn.close()

    return True


def C_delete_repertoire(**kwargs):
    """Supprime le dossier 'repertoire' s'il existe."""
    ti = kwargs['ti']
    repertoire = ti.xcom_pull(key='repertoire')
    if not repertoire:
        logger.info("Aucun repertoire enregistré, rien à supprimer")
        return True

    try:
        p = Path(repertoire)
        if p.exists():
            # Utiliser shutil.rmtree pour robustesse
            shutil.rmtree(repertoire, ignore_errors=True)
            logger.info(f"Répertoire supprimé: {repertoire}")
        else:
            logger.info(f"Répertoire déjà inexistant: {repertoire}")
        return True
    except Exception as e:
        logger.error(f"Erreur suppression repertoire: {e}")
        # On continue quand même vers la mise à jour DB
        return False


def D_update_database(**kwargs):
    """Met à jour le statut et nettoie 'repertoire' en DB"""
    ti = kwargs['ti']
    db = json.loads(ti.xcom_pull(key='db'))
    torrent_id = ti.xcom_pull(key='torrent_id')

    conn = pymysql.connect(
        host=db["DB_HOST"],
        user=db["DB_USER"],
        password=db["DB_PASSWORD"],
        db=db["DB_NAME"],
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE ygg_torrents_new SET statut = '➕ Ajouter', repertoire = NULL WHERE id = %s",
                (torrent_id,)
            )
            conn.commit()
            logger.info(f"Statut DB mis à jour pour id={torrent_id}")
    finally:
        conn.close()

    return True


with DAG(
    "torrents_delete",
    default_args=default_args,
    description="Supprime les fichiers d'un torrent et réinitialise le statut",
    schedule_interval=None,
    start_date=days_ago(1),
    catchup=False,
    tags=["torrents"],
) as dag:

    dag.doc_md = """
    # DAG Torrents Delete

    Supprime le dossier du torrent s'il existe puis remet le statut à '➕ Ajouter'.

    Paramètres attendus (conf):
    - torrent_id: identifiant du torrent en DB
    - user: (optionnel) utilisateur ayant déclenché la suppression
    """

    A_retrieve_params_task = PythonOperator(
        task_id="A_retrieve_params",
        python_callable=A_retrieve_params,
    )

    B_fetch_repertoire_task = PythonOperator(
        task_id="B_fetch_repertoire",
        python_callable=B_fetch_repertoire,
    )

    C_delete_repertoire_task = PythonOperator(
        task_id="C_delete_repertoire",
        python_callable=C_delete_repertoire,
    )

    D_update_database_task = PythonOperator(
        task_id="D_update_database",
        python_callable=D_update_database,
    )

    A_retrieve_params_task >> B_fetch_repertoire_task >> C_delete_repertoire_task >> D_update_database_task
