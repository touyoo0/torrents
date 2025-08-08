#!/bin/bash

# Récupérer les arguments
torrent_id=$1
category=$2
repertoire=$3

echo "Le torrent ID est : $torrent_id"
echo "La catégorie est : $category"
echo "Le répertoire est : $repertoire"

# Activer le bon environnement virtuel
source /home/touyoo/airflow/venv/bin/activate

# Déclencher le DAG Airflow avec les paramètres
airflow dags trigger torrents_finished \
    --conf "{\"torrent_id\": \"$torrent_id\", \"category\": \"$category\", \"repertoire\": \"$repertoire\"}"