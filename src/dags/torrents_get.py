import logging
from datetime import datetime, timedelta
from sre_parse import AT_END
from unittest.result import TestResult
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
        tmdb_key = Variable.get("TORRENTS_TMDB_TOKEN")
        
        logger.info(f"Variables récupérées avec succès: ygg={ygg}, db={db}, tmdb_key={tmdb_key}")
        return ygg, db, tmdb_key
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise

def A_retrieve_variables(**kwargs):
    """Étape 1: Récupérer les variables depuis Airflow"""
    ti = kwargs['ti']
    try:
        ygg, db, tmdb_key = get_variables()
        
        # Passer les variables à l'étape suivante
        ti.xcom_push(key='ygg', value=ygg)
        ti.xcom_push(key='db', value=db)
        ti.xcom_push(key='tmdb_key', value=tmdb_key)
        
        logger.info(f"Variables récupérées avec succès")
        return ygg, db, tmdb_key
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des variables: {str(e)}")
        raise

def B_get_torrents(**kwargs):
    """Étape 2: Récupérer les torrents depuis l'api YGG"""
    ti = kwargs['ti']
    ygg = ti.xcom_pull(key='ygg')
    base_url = json.loads(ygg)["BASE_URL"]

    torrents_list = []

    url = base_url + "torrents?order_by=uploaded_at&limit=25&category_id="
    for api in [url + '2178', url + '2183', url + '2184']:
            if api == url + '2178':
                category = "Film d'animation"
            elif api == url + '2183':
                category = "Film"
            else:
                category = "Série"
            logger.info(f"Récupération des torrents pour la catégorie {category}")
            response = requests.get(api)
            if response.status_code != 200:
                logger.error(f"Erreur lors de la récupération des données sur l'api {api}: {response.status_code}")
                continue
            for item in response.json():
                id = item['id']
                name = item['title'].replace("'", "")
                size = round(item['size'] / (1024**3), 2)
                logger.info(f"- {name}")
                torrents_list.append({
                    'id': id,
                    'name': name,
                    'category': category,
                    'size': size
                })
    ti.xcom_push(key='torrents_list', value=torrents_list)
    return len(torrents_list)

def C_filter_torrents(**kwargs):
    """Étape 3: Filtrer les torrents"""
    ti = kwargs['ti']
    torrents_list = ti.xcom_pull(key='torrents_list')

    torrents_filtered = []

    # Définition des groupes de filtres pour une meilleure organisation
    filter_resolution = ["1080", "2160", "4K"]
    filter_language = ["VF", "MULTI", "FRENCH", "VFF"]
    filter_exclude = ["VFQ"]
    filter_size = 10
    
    logger.info(f"Filtres actifs : résolution {filter_resolution}, langue {filter_language}, exclusions {filter_exclude} et taille {filter_size}")

    for torrent in torrents_list:
        name = torrent['name']
        upcase_name = name.upper()
        size = torrent['size']
        category = torrent['category']
        # Vérification des critères: (1080 ou 2160 ou 4K) ET (VF ou MULTI ou FRENCH ou VFF) ET pas VFQ
        has_resolution = any(res in upcase_name for res in filter_resolution)
        has_language = any(lang in upcase_name for lang in filter_language)
        has_exclude = any(excl in upcase_name for excl in filter_exclude)
        
        if has_resolution and has_language and not has_exclude and size < filter_size:

            if category == "Série":
                saison = re.search(r'S(\d+)', upcase_name)
                saison_integral = re.search(r'INT[EÉ]GRAL[E]?|COMPL[EÈÊ]TE', upcase_name)

                episode = re.search(r'E(\d+)', upcase_name)
                if saison:
                    saison = str(int(saison.group(1)))
                    if episode:
                        episode = str(int(episode.group(1)))
                    else:
                        episode = None
                    torrents_filtered.append(
                        {
                            'id': torrent['id'],
                            'name': torrent['name'],
                            'category': category,
                            'size': size,
                            'saison': saison,
                            'episode': episode
                        }
                    )
                    logger.info(f"Torrent filtré: {name} - ({size}Go)")
                elif saison_integral:
                    saison = 'INTEGRALE'
                    torrents_filtered.append(
                        {
                            'id': torrent['id'],
                            'name': torrent['name'],
                            'category': category,
                            'size': size,
                            'saison': saison,
                            'episode': None
                        }
                    )
                    logger.info(f"Torrent filtré: {name} - ({size}Go)")
                else:
                    logger.info(f"Torrent ignoré (saison non trouvée): {name} - ({size}Go)")
            else:
                torrents_filtered.append(
                    {
                        'id': torrent['id'],
                        'name': torrent['name'],
                        'category': category,
                        'size': size,
                        'saison': None,
                        'episode': None
                    }
                )
                logger.info(f"Torrent filtré: {name} - ({size}Go)")
        else:
            logger.info(f"Torrent ignoré (taille non conforme): {name} - ({size}Go)")

    ti.xcom_push(key='torrents_filtered', value=torrents_filtered)
    return len(torrents_filtered)

def D_check_existing_torrents(**kwargs):
    """Étape 4  : Vérifier si les torrents existent"""
    ti = kwargs['ti']
    torrents_filtered = ti.xcom_pull(key='torrents_filtered')
    db = ti.xcom_pull(key='db')
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
            cursor.execute("SELECT id FROM ygg_torrents_new WHERE id = %s", (torrent['id'],))
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
        return len(torrents_checked)

    except Exception as e:
        logger.error(f"Erreur lors de la vérification des torrents: {str(e)}")
        raise

def E_get_tmdb_details(**kwargs):
    """Étape 5: Obtenir les détails des films et séries"""
    ti = kwargs['ti']
    try:
        tmdb_key = ti.xcom_pull(key='tmdb_key')
        torrents_checked = ti.xcom_pull(key='torrents_checked')

        torrents_tmdb = []

        for torrent in torrents_checked:
            id = torrent['id']
            category = torrent['category']
            name = torrent['name'].replace(".", " ")
            size = torrent['size']
            saison = torrent['saison']
            episode = torrent['episode']

            if category == "Film" or category == "Film d'animation":
                title_match = re.search(r"^(.*?)(?=[ \(]\d{4}[ \)])", name)
                year_match = re.search(r"\b(\d{4})\b", name)
            else:
                title_match = re.search(r"^(.*?)(?=[. -][Ss]\d{1,2}|[. -](?:INTEGRAL|INTEGRALE|iNTEGRALE|COMPLETE|SAISON))", name)
                year_match = re.search(r"\b(\d{4})\b", name)
                
            if (not title_match or not year_match) and (category == "Film" or category == "Film d'animation"):
                logger.info(f"Titre ou année non trouvé pour le torrent {name}")
                continue
            elif not title_match and category == "Série":
                logger.info(f"Titre non trouvé pour le torrent {name}")
                continue

            title = title_match.group(1)

            if year_match:
                year = year_match.group(1)
            else:
                year = None

            if category == "Film" or category == "Film d'animation":
                search_url = f"https://api.themoviedb.org/3/search/movie?api_key={tmdb_key}&query={title}&year={year}&language=fr-FR"
            else:
                if year:
                    search_url = f"https://api.themoviedb.org/3/search/tv?api_key={tmdb_key}&query={title}&year={year}&language=fr-FR"
                else:
                    search_url = f"https://api.themoviedb.org/3/search/tv?api_key={tmdb_key}&query={title}&language=fr-FR"
            response = requests.get(search_url)
            if response.status_code == 200:
                results = response.json().get("results", [])
                if results:
                    # Prendre le premier résultat
                    tmdb = results[0]
                    if category == "Série":
                        tmdb_title = tmdb['name']
                        tmdb_release_date = tmdb['first_air_date']
                    else:
                        tmdb_title = tmdb['title']
                        tmdb_release_date = tmdb['release_date']
                    tmdb_id = tmdb['id']
                    tmdb_overview = tmdb['overview']
                    
                    
                    logger.info(f"{category} trouvé : {name} : --- {tmdb_title} ---")

                    # Récupérer l'affiche
                    poster_path = tmdb.get('poster_path')
                    if poster_path:
                        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                    else:
                        poster_url = ""

                    # Récupérer les genres du film
                    genres_url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={tmdb_key}&language=fr-FR"
                    genres_response = requests.get(genres_url)
                    genres = None
                    if genres_response.status_code == 200:
                        genres = genres_response.json()
                        # Récupérer les genres du film
                        genres = [genre['name'] for genre in genres.get('genres', [])]  # Liste des genres
                        genres = ','.join(genres)

                    # Récupérer la bande-annonce
                    videos_url = f"https://api.themoviedb.org/3/movie/{tmdb_id}/videos?api_key={tmdb_key}&language=fr-FR"
                    videos_response = requests.get(videos_url)
                    trailer_url = None
                    if videos_response.status_code == 200:
                        videos = videos_response.json().get("results", [])
                        if videos:
                            # Prendre la première bande-annonce (s'il y en a)
                            trailer = next((v for v in videos if v['type'] == 'Trailer'), None)
                            if trailer:
                                trailer_url = f"https://www.youtube.com/watch?v={trailer['key']}"
                    if not all([tmdb_title, tmdb_release_date, poster_url, tmdb_overview]):
                        logger.warning(f"Torrent incomplet ignoré : {name}")
                        continue
                    torrents_tmdb.append({
                        "id": id,
                        "name": name,
                        "category": category,
                        "title": tmdb_title,
                        "size": size,
                        "year": tmdb_release_date[:4],
                        "poster_url": poster_url,
                        "overview": tmdb_overview,
                        "trailer_url": trailer_url,
                        "genres": genres,
                        "release_date": tmdb_release_date,
                        "saison": saison,
                        "episode": episode
                    })
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des détails des films: {str(e)}")
        raise

    ti.xcom_push(key='torrents_tmdb', value=torrents_tmdb)
    return len(torrents_tmdb)

def F_filter_existing_torrents(**kwargs):
    """Étape 6: Filtrer les torrents existants"""
    ti = kwargs['ti']
    torrents_tmdb = ti.xcom_pull(key='torrents_tmdb')
    db = ti.xcom_pull(key='db')
    torrents_new = []

    try:
        conn = pymysql.connect(
            host= json.loads(db)["DB_HOST"],
            user=json.loads(db)["DB_USER"],
            password=json.loads(db)["DB_PASSWORD"],
            db=json.loads(db)["DB_NAME"]
            )
        cursor = conn.cursor()

        for torrent in torrents_tmdb:

            category = torrent['category']
            title = torrent['title']
            size = torrent['size']
            saison = torrent['saison']
            episode = torrent['episode']

            upcase_name = torrent['name'].upper()
            if re.search(r"(4K|2160P)", upcase_name):
                query_filter = "AND (name LIKE '%%4K%%' OR name LIKE '%%2160P%%')"
            else:
                query_filter = "AND name LIKE '%%1080P%%'"
                
            # Build query parameters dynamically
            params = [title]
            
            if category == "Série":
                if saison:
                    query_filter += " AND saison = %s"
                    params.append(saison)
                    if episode:
                        query_filter += " AND episode = %s"
                        params.append(episode)

            sql = (
                "SELECT name, size, statut, info_hash "
                "FROM ygg_torrents_new WHERE title = %s " + query_filter
            )
            cursor.execute(sql, tuple(params))
            name_db = cursor.fetchone()

            if name_db is not None:
                if name_db[1] > size and name_db[2] == "➕ Ajouter":
                    cursor.execute("DELETE FROM ygg_torrents_new WHERE info_hash = %s", (name_db[3],))
                    logger.info(f"Torrent remplacé car trouvé en plus léger: {torrent['name']}")
                    torrents_new.append(torrent)
                    conn.commit()
                else:
                    logger.info(f"Torrent non remplacé (film déjà existant en 4K/2160P): {torrent['name']}")
                    continue
            else:
                logger.info(f"Nouveau torrent : {torrent['title']} ({torrent['name']}) ({size}GiB)")
                torrents_new.append(torrent)
                conn.commit()
        cursor.close()
        conn.close()

        ti.xcom_push(key='torrents_new', value=torrents_new)
        return len(torrents_new)

    except Exception as e:
        logger.error(f"Erreur lors du filtrage des torrents existants: {str(e)}")
        raise
            


def G_get_torrents_data(**kwargs):
    """Étape 7: Obtenir les données des torrents"""
    ti = kwargs['ti']
    ygg = ti.xcom_pull(key='ygg')
    base_url = json.loads(ygg)["BASE_URL"]
    torrents_new = ti.xcom_pull(key='torrents_new', task_ids='F_filter_existing_torrents')

    torrents_data = []

    for torrent in torrents_new:

        id = torrent['id']
        category = torrent['category']
        year = torrent['year']
        release_date = torrent['release_date']
        statut = '➕ Ajouter'
        poster_url = torrent['poster_url']
        overview = torrent['overview']
        trailer_url = torrent['trailer_url']
        genres = torrent['genres']
        title = torrent['title']
        name = torrent['name'].replace("'", "")
        saison = torrent['saison']
        episode = torrent['episode']

        logger.info(f"Récupération des données du torrent {title}")
        url = base_url + "torrent/" + str(id)
        response = requests.get(url)
        if response.status_code != 200:
            logger.error(f"Erreur lors de la récupération des données sur l'api {url}: {response.status_code}")
            continue
        else:
            response_torrent = response.json()
            size = round(response_torrent['size'] / (1024**3), 2)
            info_hash = response_torrent['hash']
            created_at = response_torrent['uploaded_at']

            if not all([info_hash, name, size, created_at]):
                logger.warning(f"Torrent incomplet ignoré: {name}")
                continue
            torrents_data.append({
                'id': id,
                'info_hash': info_hash,
                'name': name,
                'size': size,
                'created_at': created_at,
                'title': title,
                'year': year,
                'poster_url': poster_url,
                'genres': genres,
                'trailer_url': trailer_url,
                'overview': overview,
                'statut': statut,
                'category': category,
                'release_date': release_date,
                'saison': saison,
                'episode': episode
                
            })
    ti.xcom_push(key='torrents_data', value=torrents_data)
    return len(torrents_data)

def H_add_torrents(**kwargs):
    """Étape 8: Ajouter les torrents"""
    ti = kwargs['ti']
    try:
        db = ti.xcom_pull(key='db')
        torrents_data = ti.xcom_pull(key='torrents_data', task_ids='G_get_torrents_data')
    
        conn = pymysql.connect(
            host=json.loads(db)["DB_HOST"],
            user=json.loads(db)["DB_USER"],
            password=json.loads(db)["DB_PASSWORD"],
            db=json.loads(db)["DB_NAME"]
            )
        cursor = conn.cursor()
        
        for torrent in torrents_data:
            id = torrent['id']
            info_hash = torrent['info_hash']
            name = torrent['name']
            size = torrent['size']
            created_at = torrent['created_at']
            title = torrent['title']
            year = torrent['year']
            poster_url = torrent['poster_url']
            genres = torrent['genres']
            trailer_url = torrent['trailer_url']
            overview = torrent['overview']
            statut = torrent['statut']
            category = torrent['category']
            release_date = torrent['release_date']
            saison = torrent['saison']
            episode = torrent['episode']
            
            cursor.execute("INSERT INTO ygg_torrents_new (id,info_hash,name,size,created_at,title,year,poster_url,genres,trailer_url,overview,statut,categorie,release_date,saison,episode) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", 
            (id, info_hash, name, size, created_at, title, year, poster_url, genres, trailer_url, overview, statut, category, release_date, saison, episode))
            conn.commit()
            logger.info(f"Torrent ajouté avec succès: {name}")
        cursor.close()
        conn.close()

        return len(torrents_data)
    except Exception as e:
        logger.error(f"Erreur lors de l'ajout des torrents: {str(e)}")
        raise

def I_add_series_subscription(**kwargs):
    """Étape 9: Ajouter les séries dans series_subscription"""
    ti = kwargs['ti']
    try:
        db = ti.xcom_pull(key='db')
        torrents_data = ti.xcom_pull(key='torrents_data', task_ids='G_get_torrents_data')
    
        new_series = []

        conn = pymysql.connect(
            host=json.loads(db)["DB_HOST"],
            user=json.loads(db)["DB_USER"],
            password=json.loads(db)["DB_PASSWORD"],
            db=json.loads(db)["DB_NAME"]
            )
        cursor = conn.cursor()

        for torrent in torrents_data:
            title = torrent['title']
            category = torrent['category']
            if category == "Série":
                cursor.execute("SELECT * FROM series_subscription WHERE title = %s", (title,))
                existing_torrent = cursor.fetchone()
                if existing_torrent:
                    logger.info(f"Série non ajoutée (déja existante): {title}")
                    continue
                else:
                    cursor.execute("INSERT INTO series_subscription (Série,Statut,last_saison,last_episode) VALUES (%s, %s, %s, %s)", (title, 'Non actif', '1', '1'))
                    conn.commit()
                    logger.info(f"Série ajoutée avec succès: {title}")
                    new_series.append(title)
        cursor.close()
        conn.close()

        return len(new_series)
    except Exception as e:
        logger.error(f"Erreur lors de la connexion à la base de données: {str(e)}")
        raise


# Définition du DAG
with DAG(
    "torrents_get",
    default_args=default_args,
    description="Récupère les nouveaux torrents depuis l'api YGG",
    schedule_interval="* * * 1 * *",  # modifie cette ligne
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
    5. **E_get_movie_details**: Obtenir les détails des films
    6. **F_filter_existing_torrents**: Filtrage des torrents existants
    7. **G_get_torrents_data**: Obtenir les données des torrents
    8. **H_add_torrents**: Ajout des torrents
    9. **I_add_series_subscription**: Ajout des séries dans series_subscription
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

    # Étape 5: Filtrer les torrents
    E_get_tmdb_details_task = PythonOperator(
        task_id="E_get_tmdb_details",
        python_callable=E_get_tmdb_details,
        doc_md="""### Obtenir les détails des films
        
        Cette tâche récupère les détails des films.
        """
    )
    
    # Étape 6: Obtenir les données des torrents
    F_filter_existing_torrents_task = PythonOperator(
        task_id="F_filter_existing_torrents",
        python_callable=F_filter_existing_torrents,
        doc_md="""### Filtrage des torrents existants
        
        Cette tâche filtre les torrents existants.
        """
    )

    # Étape 7: Ajout des torrents
    G_get_torrents_data_task = PythonOperator(
        task_id="G_get_torrents_data",
        python_callable=G_get_torrents_data,
        doc_md="""### Ajout des torrents
        
        Cette tâche récupère les données des torrents.
        """
    )

    # Étape 8: Ajout des torrents
    H_add_torrents_task = PythonOperator(
        task_id="H_add_torrents",
        python_callable=H_add_torrents,
        doc_md="""### Ajout des torrents
        
        Cette tâche ajoute les torrents.
        """
    )
    
    # Étape 9: Ajout des séries dans series_subscription
    I_add_series_subscription_task = PythonOperator(
        task_id="I_add_series_subscription",
        python_callable=I_add_series_subscription,
        doc_md="""### Ajout des séries dans series_subscription
        
        Cette tâche ajoute les séries dans series_subscription.
        """
    )
    # Définir l'ordre d'exécution des tâches    
    A_retrieve_variables_task >> B_get_torrents_task >> C_filter_torrents_task >> D_check_existing_torrents_task >> E_get_tmdb_details_task >> F_filter_existing_torrents_task >> G_get_torrents_data_task >> H_add_torrents_task >> I_add_series_subscription_task
