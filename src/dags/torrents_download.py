import logging
from datetime import datetime, timedelta
import requests
import json
import pymysql
import re

# Imports Airflow
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import Variable
from airflow.utils.dates import days_ago
from airflow.exceptions import AirflowSkipException

logger = logging.getLogger("torrents_download")

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
        ygg = Variable.get("TORRENTS_YGG")
        db = Variable.get("TORRENTS_DATABASE")
        qb = Variable.get("TORRENTS_QB")
        
        logger.info(f"Variables récupérées avec succès:")
        logger.info(f"ygg={ygg}")
        logger.info(f"qb={qb}")
        logger.info(f"db={db}")
        return ygg, db, qb
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise

def A_retrieve_variables(**kwargs):
    """Étape 1: Récupérer les variables depuis Airflow"""
    ti = kwargs['ti']
    try:
        ygg, db, qb = get_variables()
        
        # Récupérer les paramètres passés lors du déclenchement du DAG
        dag_run = kwargs.get('dag_run')
        
        if not dag_run:
            logger.error("dag_run est None")
            raise AirflowSkipException("dag_run est None")
        
        if not hasattr(dag_run, 'conf') or not dag_run.conf:
            logger.error("Aucune configuration fournie dans le dag_run")
            raise AirflowSkipException("Aucune configuration fournie")
        
        # Récupérer les paramètres avec gestion d'erreur
        try:
            torrent_id = dag_run.conf.get('torrent_id')
            category = dag_run.conf.get('category')
            title = dag_run.conf.get('title')
            logger.info(f"Paramètres extraits: torrent_id={torrent_id}, category={category}, title={title}")
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction des paramètres: {str(e)}")
            raise AirflowSkipException(f"Erreur paramètres: {str(e)}")
        
        if not torrent_id:
            raise AirflowSkipException("Aucun ID de torrent fourni")
        
        # Passer les variables à l'étape suivante
        ti.xcom_push(key='ygg', value=ygg)
        ti.xcom_push(key='qb', value=qb)
        ti.xcom_push(key='db', value=db)
        ti.xcom_push(key='torrent_id', value=torrent_id)
        ti.xcom_push(key='category', value=category)
        ti.xcom_push(key='title', value=title)

        return ygg, qb, db, torrent_id, category
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise

def B_download_torrent(**kwargs):

    ti = kwargs['ti']
    ygg = ti.xcom_pull(key='ygg')
    qb = ti.xcom_pull(key='qb')
    torrent_id = ti.xcom_pull(key='torrent_id')
    category = ti.xcom_pull(key='category')
    title = ti.xcom_pull(key='title')

    qb_host = json.loads(qb)["QB_HOST"]
    qb_username = json.loads(qb)["QB_USER"]
    qb_password = json.loads(qb)["QB_PASSWORD"]
    qb_savepath = json.loads(qb)["QB_SAVEPATH"]

    if category == "Série":
        qb_savepath = qb_savepath + '/Séries/' + title
        qb_category = "Series-DAG"
    else:
        qb_savepath = qb_savepath + '/Films/'
        qb_category = "Films-DAG"
    

    ygg_base_url = json.loads(ygg)["BASE_URL"]
    ygg_passkey = json.loads(ygg)["PASSKEY"]
    
    torrent_url = ygg_base_url + 'torrent/' + str(torrent_id) + '/download?passkey=' + ygg_passkey

    session = requests.Session()
    # Connexion
    login_data = {'username': qb_username, 'password': qb_password}
    response = session.post(f'{qb_host}/api/v2/auth/login', data=login_data)
    if response.text != 'Ok.':
        logger.error("Échec de l'authentification.")
        return False
    
    # Télécharger le fichier .torrent
    torrent_response = session.get(torrent_url)
    if torrent_response.status_code != 200:
        logger.error("Erreur lors du téléchargement du fichier .torrent :", torrent_response.status_code)
        return False

    # Préparation des données pour l'ajout
    data = {
        'savepath': qb_savepath,
        'category': qb_category
    }
    
    # Ajouter le torrent modifié
    files = {'torrents': ('download.torrent', torrent_response.content)}
    response = session.post(f'{qb_host}/api/v2/torrents/add', data=data, files=files)
    
    if response.status_code == 200:
        logger.info("Torrent ajouté avec succès !")
        return True
    else:
        logger.error("Erreur lors de l'ajout du torrent.")
        ti.xcom_push(key='skip_next_tasks', value=True)
        return False

def C_update_database(**kwargs):
    ti = kwargs['ti']
    db = ti.xcom_pull(key='db')
    torrent_id = ti.xcom_pull(key='torrent_id')

    skip_next_tasks = ti.xcom_pull(key='skip_next_tasks')
    if skip_next_tasks:
        logger.info("Étape ignorée: aucun torrent téléchargé")
        raise AirflowSkipException("Aucun torrent téléchargé")

    try:
        conn = pymysql.connect(
            host=json.loads(db)["DB_HOST"],
            user=json.loads(db)["DB_USER"],
            password=json.loads(db)["DB_PASSWORD"],
            db=json.loads(db)["DB_NAME"]
        )
        cursor = conn.cursor()
        cursor.execute("UPDATE ygg_torrents_new SET statut = '⌛ Téléchargement' WHERE id = %s", (torrent_id,))
        conn.commit()
        cursor.close()
        conn.close()
        logger.info("Statut mis à jour avec succès !")
        return True
    except Exception as e:
        logger.error("Erreur lors de la mise à jour du statut :", e)
        raise
        return False


# Définition du DAG
with DAG(
    "torrents_download",
    default_args=default_args,
    description="Télécharge un torrent spécifique via qBittorrent",
    schedule_interval=None,  # DAG déclenché manuellement ou via l'API
    start_date=days_ago(1),
    catchup=False,
    tags=["torrents"],
) as dag:
    # Documentation du DAG
    dag.doc_md = """
    # DAG Torrents Download
    
    Ce DAG télécharge un torrent spécifique via qBittorrent.
    
    ## Paramètres:
    - **torrent_id**: ID du torrent à télécharger
    - **category**: Catégorie du torrent (Film, Série, etc.)
    
    ## Étapes:
    1. **A_retrieve_variables**: Récupération des variables et paramètres
    2. **B_download_torrent**: Téléchargement du torrent via qBittorrent
    3. **C_update_database**: Mise à jour de la base de données
    """
    
    # Étape 1: Récupérer les variables et paramètres
    A_retrieve_variables_task = PythonOperator(
        task_id="A_retrieve_variables",
        python_callable=A_retrieve_variables,
        doc_md="""### Récupération des variables et paramètres
        
        Cette tâche récupère les variables nécessaires depuis Airflow et les paramètres du DAG.
        """
    )
    
    # Étape 2: Récupérer les détails du torrent
    B_download_torrent_task = PythonOperator(
        task_id="B_download_torrent",
        python_callable=B_download_torrent,
        doc_md="""### Téléchargement du torrent
        
        Cette tâche télécharge le torrent via qBittorrent.
        """
    )
    
    # Étape 3: Mise à jour de la base de données
    C_update_database_task = PythonOperator(
        task_id="C_update_database",
        python_callable=C_update_database,
        doc_md="""### Mise à jour de la base de données
        
        Cette tâche met à jour la base de données avec le statut du torrent.
        """
    )
    
    # Définir l'ordre d'exécution des tâches
    A_retrieve_variables_task >> B_download_torrent_task >> C_update_database_task
