#!/bin/bash

# Récupérer les arguments
torrent_id=$1
category=$2
repertoire=$3

echo "Le torrent ID est : $torrent_id"
echo "La catégorie est : $category"
echo "Le répertoire est : $repertoire"

# Vérifier si la catégorie contient "DAG"
if [[ "$category" == *"DAG"* ]]; then
    echo "Catégorie valide, déclenchement du DAG Airflow..."

    # Activer l'environnement virtuel d'Airflow
    source /home/touyoo/airflow/venv/bin/activate

    # Déclencher le DAG avec les paramètres
    airflow dags trigger torrents_finished \
        --conf "{\"torrent_id\": \"$torrent_id\", \"category\": \"$category\", \"repertoire\": \"$repertoire\"}"
else
    echo "Catégorie ignorée (ne contient pas 'DAG'), aucun DAG déclenché."
fi
