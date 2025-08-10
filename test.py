import requests
import json
import logging

logger = logging.getLogger("torrents_get")

def test():
    ygg = ""
    rss_url = "https://rss.dathomir.fr/rss"
    passkey = "hVZRK43ANPcOFZnMqEmSSuMHPAqy4N0x"

    torrents_list = []

    url = rss_url + "?id=2140&passkey=" + passkey
    print(url)
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

            title = (title_el.text or '').strip() if title_el is not None else None
            pubdate = (pub_el.text or '').strip() if pub_el is not None else None
            enclosure_url = encl_el.get('url') if encl_el is not None else None
            size = round(int(encl_el.get('length')) / (1024**2), 2) if encl_el is not None else None

            print(f"- {title} | {pubdate} | {enclosure_url} | {size}")  

            logger.info(f"- {title} | {pubdate} | {enclosure_url} | {size}")
            torrents_list.append({
                'title': title,
                'pubDate': pubdate,
                'enclosure_url': enclosure_url,
                'size': size
            })
    except Exception as e:
        logger.error(f"Erreur de parsing RSS: {e}")
        return 0

    #ti.xcom_push(key='torrents_list', value=torrents_list)
    return len(torrents_list)

if __name__ == '__main__':
    test()
    