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

def A_retrieve_variables(**context):
    """Étape 1: Récupérer les variables depuis Airflow"""
    ti = context['ti']
    try:
        db, jellyfin_token = get_variables()
        
        # Passer les variables à l'étape suivante
        ti.xcom_push(key='db', value=db)
        ti.xcom_push(key='jellyfin_token', value=jellyfin_token)

        conf = (context.get("dag_run") or {}).conf or {}
        info_hash = conf.get("torrent_id")   # correspond à sys.argv[1] dans ton script
        category = conf.get("category")      # sys.argv[2] (optionnel ici)
        repertoire = conf.get("repertoire")  # sys.argv[3]
        user = conf.get("user")              # sys.argv[4]


        logger.info(f"Variables récupérées avec succès")
        logger.info(f"info_hash = {info_hash}")
        logger.info(f"category = {category}")
        logger.info(f"repertoire = {repertoire}")
        logger.info(f"user = {user}")
        
        return db, jellyfin_token, info_hash, category, repertoire, user
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise

default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": 0,
}

with DAG(
    dag_id="torrents_finished_books",
    description="Met à jour le statut d'un torrent en '✔️ Téléchargé' après fin de téléchargement",
    start_date=datetime(2024, 1, 1),
    schedule=None,  # déclenché à la demande
    catchup=False,
    default_args=default_args,
    tags=["torrents", "fin"],
) as dag:

    dag.doc_md = """
    # DAG Torrents Get
    
    Ce DAG
    
    ## Étapes:
    1. **A_retrieve_variables**: Récupération des variables
    """
    
    A_retrieve_variables_task = PythonOperator(
        task_id="A_retrieve_variables",
        python_callable=A_retrieve_variables,
        provide_context=True,
    )

    A_retrieve_variables_task