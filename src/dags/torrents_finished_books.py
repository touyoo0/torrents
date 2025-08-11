# /home/touyoo/airflow/dags/torrents/torrents_finished.py
from datetime import datetime
import os
import logging
import pymysql
import json
import requests
from datetime import timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import shutil

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
        smtp = Variable.get("TORRENTS_SMTP")
        
        logger.info(f"Variables récupérées avec succès: db={db}")
        return db, smtp
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise

def A_retrieve_variables(**context):
    """Étape 1: Récupérer les variables depuis Airflow"""
    ti = context['ti']
    try:
        db, smtp = get_variables()
        
        # Passer les variables à l'étape suivante
        ti.xcom_push(key='db', value=db)
        ti.xcom_push(key='smtp', value=smtp)
        
        conf = (context.get("dag_run") or {}).conf or {}
        user = conf.get("user")              # sys.argv[4]
        repertoire = conf.get("repertoire")  # sys.argv[3]

        ti.xcom_push(key='user', value=user)
        ti.xcom_push(key='repertoire', value=repertoire)

        logger.info(f"Variables récupérées avec succès")
        logger.info(f"smtp = {smtp}")
        logger.info(f"db = {db}")
        logger.info(f"repertoire = {repertoire}")
        logger.info(f"user = {user}")
        
        return db, smtp, repertoire, user
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise

def B_get_user_email(**context):
    """Étape 2: Récupérer l'email de l'utilisateur"""
    ti = context['ti']
    try:

        db = ti.xcom_pull(key='db')
        user = ti.xcom_pull(key='user')

        DB_HOST = json.loads(db)["DB_HOST"]
        DB_USER = json.loads(db)["DB_USER"]
        DB_PASSWORD = json.loads(db)["DB_PASSWORD"]
        DB_NAME = json.loads(db)["DB_NAME"]

        conn = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            db=DB_NAME,
        )
        cursor = conn.cursor()
        cursor.execute("SELECT email FROM users WHERE name = %s", (user,))
        row = cursor.fetchone()
        email = row[0] if row and len(row) > 0 else None
        cursor.close()
        conn.close()

        logger.info(f"Email de l'utilisateur récupéré avec succès: {user}")
        ti.xcom_push(key='email', value=email)
        return email
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de l'email de l'utilisateur: {str(e)}")
        raise

def C_send_email(**context):
    """Étape 3: Envoyer un email"""
    ti = context['ti']

    repertoire = ti.xcom_pull(key='repertoire')
    email = ti.xcom_pull(key='email')
    smtp = ti.xcom_pull(key='smtp')

    SMTP_HOST = json.loads(smtp)["SMTP_HOST"]
    SMTP_PORT = json.loads(smtp)["SMTP_PORT"]
    SMTP_USER = json.loads(smtp)["SMTP_USER"]
    SMTP_PASSWORD = json.loads(smtp)["SMTP_PASSWORD"]

    try:
       # Création du message
        msg = MIMEMultipart()
        msg["Subject"] = "Livre"
        msg["From"] = SMTP_USER
        msg["To"] = email
        # Corps du message
        msg.attach(MIMEText("Nouveau livre", "plain"))

        # Pièces jointes: si 'repertoire' est un dossier, joindre tous les fichiers; si c'est un fichier, joindre ce fichier
        if repertoire and os.path.exists(repertoire):
            try:
                files_to_attach = []
                if os.path.isdir(repertoire):
                    for name in os.listdir(repertoire):
                        full_path = os.path.join(repertoire, name)
                        if os.path.isfile(full_path):
                            files_to_attach.append(full_path)
                elif os.path.isfile(repertoire):
                    files_to_attach.append(repertoire)

                for file_path in files_to_attach:
                    try:
                        with open(file_path, "rb") as f:
                            part = MIMEApplication(f.read(), Name=os.path.basename(file_path))
                        part["Content-Disposition"] = f'attachment; filename="{os.path.basename(file_path)}"'
                        msg.attach(part)
                        logger.info(f"Pièce jointe ajoutée: {file_path}")
                    except Exception as inner_e:
                        logger.error(f"Erreur lors de l'attachement du fichier {file_path}: {inner_e}")
            except Exception as e:
                logger.error(f"Erreur lors du traitement des pièces jointes depuis {repertoire}: {e}")

        # Envoi
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()  # Sécurise la connexion
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

        print("E-mail envoyé avec succès ")

        return 1
    except Exception as e:
        logger.error(f"Erreur lors de l'envoi de l'email: {str(e)}")
        return 0
        raise

def D_clean_files(**context):
    """Étape 4: Nettoyer les fichiers"""
    ti = context['ti']
    try:
        repertoire = ti.xcom_pull(key='repertoire')
        if not repertoire:
            logger.info("Aucun chemin 'repertoire' fourni, rien à nettoyer.")
            return 1

        if os.path.exists(repertoire):
            if os.path.isfile(repertoire):
                os.remove(repertoire)
                logger.info(f"Fichier supprimé: {repertoire}")
            elif os.path.isdir(repertoire):
                shutil.rmtree(repertoire)
                logger.info(f"Répertoire supprimé: {repertoire}")
            else:
                logger.warning(f"Chemin non reconnu (ni fichier ni dossier): {repertoire}")
        else:
            logger.info(f"Chemin introuvable, rien à supprimer: {repertoire}")

        return 1
    except Exception as e:
        logger.error(f"Erreur lors du nettoyage des fichiers: {str(e)}")
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
    
    Ce DAG permet d'envoyer un livre par mail à l'utilisateur
    
    ## Étapes:
    1. **A_retrieve_variables**: Récupération des variables
    2. **B_get_user_email**: Récupération de l'email de l'utilisateur
    3. **C_send_email**: Envoi de l'email
    4. **D_clean_files**: Nettoyage des fichiers
    """
    
    A_retrieve_variables_task = PythonOperator(
        task_id="A_retrieve_variables",
        python_callable=A_retrieve_variables,
        provide_context=True,
    )

    B_get_user_email_task = PythonOperator(
        task_id="B_get_user_email",
        python_callable=B_get_user_email,
        provide_context=True,
    )

    C_send_email_task = PythonOperator(
        task_id="C_send_email",
        python_callable=C_send_email,
        provide_context=True,
    )

    D_clean_files_task = PythonOperator(
        task_id="D_clean_files",
        python_callable=D_clean_files,
        provide_context=True,
    )

    A_retrieve_variables_task >> B_get_user_email_task >> C_send_email_task >> D_clean_files_task