# /home/touyoo/airflow/dags/torrents/torrents_finished.py
from datetime import datetime
import os
import logging
import pymysql
import json
import requests
from datetime import timedelta

# Imports Airflow
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import Variable
from airflow.utils.dates import days_ago
from airflow.exceptions import AirflowSkipException

logger = logging.getLogger("torrents_get")

default_args = {
    "owner": "airflow",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
}

def get_variables():
    """Récupère les variables depuis Airflow"""
    try:
        db = Variable.get("TORRENTS_DATABASE")
        jellyfin_token = Variable.get("TORRENTS_JELLYFIN_TOKEN")
        
        logger.info(f"Variables récupérées avec succès: db={db}")
        return db, jellyfin_token
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise

def A_retrieve_variables(**kwargs):
    """Étape 1: Récupérer les variables depuis Airflow"""
    ti = kwargs['ti']
    try:
        db, jellyfin_token = get_variables()
        
        # Passer les variables à l'étape suivante
        ti.xcom_push(key='db', value=db)
        ti.xcom_push(key='jellyfin_token', value=jellyfin_token)
        
        logger.info(f"Variables récupérées avec succès")
        return db, jellyfin_token
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise


def B_update_database(**context):

    ti = context['ti']
    db = ti.xcom_pull(key='db')

    DB_HOST = json.loads(db)["DB_HOST"]
    DB_USER = json.loads(db)["DB_USER"]
    DB_PASSWORD = json.loads(db)["DB_PASSWORD"]
    DB_NAME = json.loads(db)["DB_NAME"]

    # Conf envoyée par le trigger CLI: --conf '{"torrent_id":"...", "category":"...", "repertoire":"..."}'
    conf = (context.get("dag_run") or {}).conf or {}
    info_hash = conf.get("torrent_id")   # correspond à sys.argv[1] dans ton script
    category = conf.get("category")      # sys.argv[2] (optionnel ici)
    repertoire = conf.get("repertoire")  # sys.argv[3]

    if not info_hash or not repertoire:
        raise ValueError("Paramètres manquants: 'torrent_id' et 'repertoire' sont requis.")

    logging.info(f"torrent_id (info_hash) = {info_hash}")
    logging.info(f"category = {category}")
    logging.info(f"repertoire = {repertoire}")

    # Connexion DB via variables d'env
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.Cursor,
        autocommit=False,
    )
    try:
        with conn.cursor() as cursor:
            # Met à jour le statut et le répertoire (comme dans ton script CLI)
            cursor.execute(
                """
                UPDATE ygg_torrents_new
                SET statut = '✔️ Téléchargé',
                    repertoire = %s
                WHERE info_hash = %s
                """,
                (repertoire, info_hash),
            )
        conn.commit()
        logging.info("Mise à jour terminée avec succès.")
    finally:
        conn.close()


def C_refresh_library(**context):
    ti = context['ti']

    # Récupérer le token depuis XCom
    jellyfin_token = ti.xcom_pull(key='jellyfin_token')
    if not jellyfin_token:
        raise ValueError("Jellyfin token manquant (XCom 'jellyfin_token').")

    # Récupérer l'URL Jellyfin depuis Airflow Variables
    base_url = "http://localhost:8096/Library/Refresh"

    headers = {
        "X-Emby-Token": jellyfin_token,
        "Accept": "application/json",
    }

    # POST /Library/Refresh (rafraîchit l'ensemble de la médiathèque)
    # Paramètres possibles: ?IsDeepScan=false (par défaut) si tu veux éviter un scan profond
    try:
        resp = requests.post(base_url, headers=headers, timeout=15)
        if resp.status_code in (200, 204):
            logger.info("Requête Jellyfin /Library/Refresh OK.")
        else:
            logger.error(f"Echec Jellyfin refresh: {resp.status_code} - {resp.text}")
            resp.raise_for_status()
    except Exception as e:
        logger.exception(f"Erreur lors de l'appel Jellyfin: {e}")
        raise
    

default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": 0,
}

with DAG(
    dag_id="torrents_finished",
    description="Met à jour le statut d'un torrent en '✔️ Téléchargé' après fin de téléchargement",
    start_date=datetime(2024, 1, 1),
    schedule=None,  # déclenché à la demande
    catchup=False,
    default_args=default_args,
    tags=["torrents", "fin"],
) as dag:

    dag.doc_md = """
    # DAG Torrents Get
    
    Ce DAG met à jour le statut d'un torrent en '✔️ Téléchargé' après fin de téléchargement.
    
    ## Étapes:
    1. **A_retrieve_variables**: Récupération des variables
    2. **B_update_database**: Mise à jour de la base de données
    3. **C_refresh_library**: Rafraîchissement de la bibliothèque
    """
    
    A_retrieve_variables_task = PythonOperator(
        task_id="A_retrieve_variables",
        python_callable=A_retrieve_variables,
        provide_context=True,
    )

    B_update_database_task = PythonOperator(
        task_id="B_update_database",
        python_callable=B_update_database,
        provide_context=True,
    )

    C_refresh_library_task = PythonOperator(
        task_id="C_refresh_library",
        python_callable=C_refresh_library,
        provide_context=True,
    )

    A_retrieve_variables_task >> B_update_database_task >> C_refresh_library_task