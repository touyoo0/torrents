import logging
from datetime import datetime, timedelta, timezone
from sre_parse import AT_END
from unittest.result import TestResult
import requests
import json
import pymysql
import re
from email.utils import parsedate_to_datetime
from urllib.parse import quote

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
        ygg= Variable.get("TORRENTS_YGG")
        db = Variable.get("TORRENTS_DATABASE")
        
        logger.info(f"Variables récupérées avec succès: ygg={ygg}, db={db}")
        return ygg, db
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise


def A_retrieve_variables(**kwargs):
    """Étape 1: Récupérer les variables depuis Airflow"""
    ti = kwargs['ti']
    try:
        ygg, db = get_variables()
        
        # Passer les variables à l'étape suivante
        ti.xcom_push(key='ygg', value=ygg)
        ti.xcom_push(key='db', value=db)
        
        logger.info(f"Variables récupérées avec succès")
        return ygg, db
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise

def B_get_torrents(**kwargs):
    """Étape 2: Récupérer les torrents depuis l'api YGG"""
    ti = kwargs['ti']
    ygg = ti.xcom_pull(key='ygg')
    rss_url = json.loads(ygg)["RSS_URL"]
    passkey = json.loads(ygg)["PASSKEY"]

    torrents_list = []

    url = rss_url + "?id=2140&passkey=" + passkey
    response = requests.get(url)
    if response.status_code != 200:
        logger.error(f"Erreur lors de la récupération des données sur l'api {url}: {response.status_code}")
        return 0
    # Parse RSS XML et extraire title, pubDate, enclosure url
    try:
        from xml.etree import ElementTree as ET
        root = ET.fromstring(response.content)
        items = root.findall('.//item')
        for it in items:
            title_el = it.find('title')
            pub_el = it.find('pubDate')
            encl_el = it.find('enclosure')

            name = (title_el.text or '').strip() if title_el is not None else None
            pubdate = (pub_el.text or '').strip() if pub_el is not None else None
            enclosure_url = encl_el.get('url') if encl_el is not None else None
            size = round(int(encl_el.get('length')) / (1024**2), 2) if encl_el is not None else None
            id_re = re.search(r"id=(.*?)&", enclosure_url)
            if id_re:
                id = id_re.group(1)
                logger.info(f"Torrent trouvé: {name} - {pubdate}")
                torrents_list.append({
                    'id': id,
                    'name': name,
                    'pubDate': pubdate,
                    'size': size,

                })
            else:
                logger.error(f"Erreur lors de la récupération de du torrent (pas d'id) : {name}")
                continue

    except Exception as e:
        logger.error(f"Erreur de parsing RSS: {e}")
        return 0

    ti.xcom_push(key='torrents_list', value=torrents_list)
    return len(torrents_list)

def C_filter_torrents(**kwargs):
    """Étape 3: Filtrer les torrents"""
    ti = kwargs['ti']
    torrents_list = ti.xcom_pull(key='torrents_list')

    torrents_filtered = []

    # Définition des groupes de filtres pour une meilleure organisation
    filter_format = ["EPUB"]
    filter_language = ["FR", "FRENCH"]
    filter_size = 3
    
    logger.info(f"Filtres actifs : format {filter_format}, langue {filter_language}, et taille {filter_size}")

    for torrent in torrents_list:
        id = torrent['id']
        name = torrent['name']
        upcase_name = name.upper()
        pubdate = torrent['pubDate']
        size = torrent['size']
        # Vérification des critères: (FR ou FRENCH)
        has_language = any(lang in upcase_name for lang in filter_language)
        has_format = any(fmt in upcase_name for fmt in filter_format)
        
        if has_language and has_format and size < filter_size:
            torrents_filtered.append(
                {
                    'id': torrent['id'],
                    'name': torrent['name'],
                    'size': size,
                    'pubDate': pubdate
                }
            )
            logger.info(f"Torrent filtré: {name} - ({size}Go)")
        else:
            logger.info(f"Torrent ignoré (non conforme): {name} - ({size}Go)")

    ti.xcom_push(key='torrents_filtered', value=torrents_filtered)

    if len(torrents_filtered) == 0:
        logger.info("Aucun torrent filtré, les étapes suivantes seront ignorées")
        # On passe un flag pour indiquer que les tâches suivantes doivent être ignorées
        ti.xcom_push(key='skip_next_tasks', value=True)

    return len(torrents_filtered)

def D_check_existing_torrents(**kwargs):
    """Étape 4  : Vérifier si les torrents existent"""
    ti = kwargs['ti']
    torrents_filtered = ti.xcom_pull(key='torrents_filtered')
    db = ti.xcom_pull(key='db')
    skip_next_tasks = ti.xcom_pull(key='skip_next_tasks')
    if skip_next_tasks:
        logger.info("Étape ignorée: aucun torrent filtré")
        raise AirflowSkipException("Aucun torrent filtré")
    try:
        torrents_checked = []
        
        conn = pymysql.connect(
        host= json.loads(db)["DB_HOST"],
        user=json.loads(db)["DB_USER"],
        password=json.loads(db)["DB_PASSWORD"],
        db=json.loads(db)["DB_NAME"]
        )
        cursor = conn.cursor()

        for torrent in torrents_filtered:
            cursor.execute("SELECT id FROM ygg_torrents_books WHERE id = %s", (torrent['id'],))
            if cursor.fetchone():
                logger.info(f"Torrent non ajouté (existant): {torrent['name']}")
                continue
            else:
                logger.info(f"Nouveau torrent : {torrent['name']}")
                torrent_checked = torrent
                torrents_checked.append(torrent_checked)
                conn.commit()
        cursor.close()
        conn.close()
        ti.xcom_push(key='torrents_checked', value=torrents_checked)
        if len(torrents_checked) == 0:
            logger.info("Aucun torrent à vérifier, les étapes suivantes seront ignorées")
            # On passe un flag pour indiquer que les tâches suivantes doivent être ignorées
            ti.xcom_push(key='skip_next_tasks', value=True)
        return len(torrents_checked)

    except Exception as e:
        logger.error(f"Erreur lors de la vérification des torrents: {str(e)}")
        raise


def E_add_torrents(**kwargs):
    """Étape 5: Ajouter les torrents"""
    ti = kwargs['ti']
    skip_next_tasks = ti.xcom_pull(key='skip_next_tasks')
    if skip_next_tasks:
        logger.info("Étape ignorée: aucun torrent à traiter")
        raise AirflowSkipException("Aucun torrent à traiter")
    try:
        db = ti.xcom_pull(key='db')
        torrents_checked = ti.xcom_pull(key='torrents_checked')
    
        conn = pymysql.connect(
            host=json.loads(db)["DB_HOST"],
            user=json.loads(db)["DB_USER"],
            password=json.loads(db)["DB_PASSWORD"],
            db=json.loads(db)["DB_NAME"]
            )
        cursor = conn.cursor()

        inserted = 0
        
        for torrent in torrents_checked:
            id = torrent['id']
            name = torrent['name']
            size = torrent['size']

            # Nettoyage name
            # 1) Remplacer les points par des espaces
            name_clean = name.replace('.', ' ')
            # 2) Supprimer le suffixe type "(S:129/L:1)" en fin de chaîne
            name_clean = re.sub(r"\s*\(S:\s*\d+\s*/\s*L:\s*\d+\)\s*$", "", name_clean, flags=re.IGNORECASE)
            # 3) Supprimer la langue FR/French (insensible à la casse) avec éventuels crochets/parenthèses/séparateurs
            name_clean = re.sub(r"[\[\(\-_/\s]*\b(fr|french)\b[\]\)\-_/\s]*", " ", name_clean, flags=re.IGNORECASE)
            # 4) Supprimer 'epub' (insensible à la casse)
            name_clean = re.sub(r"[\[\(\-_/\s]*\b(epub)\b[\]\)\-_/\s]*", " ", name_clean, flags=re.IGNORECASE)
            # 5) Supprimer 'NoTag' (insensible à la casse)
            name_clean = re.sub(r"[\[\(\-_/\s]*\b(notag)\b[\]\)\-_/\s]*", " ", name_clean, flags=re.IGNORECASE)
            # 6) Réduire les espaces multiples et trim
            name_clean = re.sub(r"\s+", " ", name_clean).strip()
            name = name_clean

            # Convertir la date RSS en DATETIME MySQL (UTC, sans timezone)
            created_at_raw = torrent.get('pubDate')
            created_at = None
            if created_at_raw:
                try:
                    dt = parsedate_to_datetime(created_at_raw)
                    # Convertir en UTC puis supprimer l'info de timezone
                    if dt.tzinfo is not None:
                        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                    created_at = dt.strftime('%Y-%m-%d %H:%M:%S')
                except Exception:
                    # Tentative via strptime si nécessaire
                    try:
                        dt = datetime.strptime(created_at_raw, '%a, %d %b %Y %H:%M:%S %z')
                        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                        created_at = dt.strftime('%Y-%m-%d %H:%M:%S')
                    except Exception:
                        # En dernier recours, laisser NULL
                        created_at = None
            category = 'Livres'
            
            cursor.execute("INSERT INTO ygg_torrents_books (id,name,size,created_at,categorie) VALUES (%s, %s, %s, %s, %s)", 
            (id, name, size, created_at, category))
            conn.commit()
            logger.info(f"Torrent ajouté avec succès: {name}")
            inserted += 1
        cursor.close()
        conn.close()
        if inserted == 0:
            logger.info("Aucun torrent à traiter, les étapes suivantes seront ignorées")
            # On passe un flag pour indiquer que les tâches suivantes doivent être ignorées
            ti.xcom_push(key='skip_next_tasks', value=True)
        return inserted
    except Exception as e:
        logger.error(f"Erreur lors de l'ajout des torrents: {str(e)}")
        raise

# Définition du DAG
with DAG(
    "torrents_get_books",
    default_args=default_args,
    description="Récupère les nouveaux torrents de livres depuis l'api YGG",
    schedule_interval="0 * * * *",  # s'exécute toutes les heures (à la minute 0)
    start_date=days_ago(1),
    catchup=False,
    tags=["torrents"],
) as dag:
    # Documentation du DAG
    dag.doc_md = """
    # DAG Torrents Get
    
    Ce DAG récupère les nouveaux torrents depuis l'api YGG.
    
    ## Étapes:
    1. **A_retrieve_variables**: Récupération des variables depuis Airflow
    2. **B_get_torrents**: Récupération des torrents depuis l'api YGG
    3. **C_filter_torrents**: Filtrage des torrents
    4. **D_check_existing_torrents**: Vérification des torrents existants
    5. **E_add_torrents**: Ajout des torrents
    """
    
    # Étape 1: Récupérer les variables depuis Airflow
    A_retrieve_variables_task = PythonOperator(
        task_id="A_retrieve_variables",
        python_callable=A_retrieve_variables,
        doc_md="""### Récupération des variables
        
        Cette tâche récupère les variables nécessaires depuis Airflow.
        """
    )
    
    # Étape 2: Récupérer les torrents depuis l'api YGG
    B_get_torrents_task = PythonOperator(
        task_id="B_get_torrents",
        python_callable=B_get_torrents,
        doc_md="""### Récupération des torrents
        
        Cette tâche récupère les torrents depuis l'api YGG.
        """
    )

    # Étape 3: Vérifier si les torrents existent
    C_filter_torrents_task = PythonOperator(
        task_id="C_filter_torrents",
        python_callable=C_filter_torrents,
        doc_md="""### Filtrage des torrents
        
        Cette tâche filtre les torrents.
        """
    )

    # Étape 4: Obtenir les détails des films
    D_check_existing_torrents_task = PythonOperator(
        task_id="D_check_existing_torrents",
        python_callable=D_check_existing_torrents,
        doc_md="""### Vérification des torrents existants
        
        Cette tâche vérifie si les torrents existent.
        """
    )

    # Étape 5: Ajout des torrents
    E_add_torrents_task = PythonOperator(
        task_id="E_add_torrents",
        python_callable=E_add_torrents,
        doc_md="""### Ajout des torrents
        
        Cette tâche ajoute les torrents.
        """
    )
    # Définir l'ordre d'exécution des tâches    
    A_retrieve_variables_task >> B_get_torrents_task >> C_filter_torrents_task >> D_check_existing_torrents_task >> E_add_torrents_task
