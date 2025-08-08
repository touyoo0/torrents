# /home/touyoo/airflow/dags/torrents/torrents_finished.py
from datetime import datetime
import os
import logging
import pymysql
from dotenv import load_dotenv

from airflow import DAG
from airflow.operators.python import PythonOperator

def mark_torrent_finished(**context):
    # Charger les variables d'environnement (.env si présent)
    load_dotenv()

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
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        db=os.getenv("DB_NAME"),
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

    finir = PythonOperator(
        task_id="mark_torrent_finished",
        python_callable=mark_torrent_finished,
        provide_context=True,
    )

    finir