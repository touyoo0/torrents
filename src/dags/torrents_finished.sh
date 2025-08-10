#!/bin/bash

# Récupérer les arguments
torrent_id=$1
category=$2
repertoire=$3
user=$4

echo "Le torrent ID est : $torrent_id"
echo "La catégorie est : $category"
echo "Le répertoire est : $repertoire"
echo "Le user est : $user"

# Vérifier si la catégorie contient "DAG"
if [[ "$category" == *"DAG"* ]]; then
    if [[ "$category" == *"Livres"* ]]; then
        echo "Catégorie Livres, déclenchement du DAG Airflow..."

        # Activer l'environnement virtuel d'Airflow
        source /home/touyoo/airflow/venv/bin/activate

        # Déclencher le DAG avec les paramètres
        airflow dags trigger torrents_finished_books \
            --conf "{\"torrent_id\": \"$torrent_id\", \"category\": \"$category\", \"repertoire\": \"$repertoire\", \"user\": \"$user\"}"      
    else
        echo "Catégorie Film/Séries, déclenchement du DAG Airflow..."

        # Activer l'environnement virtuel d'Airflow
        source /home/touyoo/airflow/venv/bin/activate

        # Déclencher le DAG avec les paramètres
        airflow dags trigger torrents_finished \
            --conf "{\"torrent_id\": \"$torrent_id\", \"category\": \"$category\", \"repertoire\": \"$repertoire\"}"
    fi
else
    echo "Catégorie ignorée (ne contient pas 'DAG'), aucun DAG déclenché."
fi
