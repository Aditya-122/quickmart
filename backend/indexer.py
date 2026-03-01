import os
from elasticsearch import AsyncElasticsearch, NotFoundError
from es_client import get_es_client
from mock_data import get_products

INDEX_NAME = os.getenv("ES_INDEX", "products")

INDEX_MAPPING = {
    "settings": {
        "analysis": {
            "analyzer": {
                "autocomplete_analyzer": {
                    "tokenizer": "autocomplete_tokenizer",
                    "filter": ["lowercase"],
                },
                "autocomplete_search_analyzer": {
                    "tokenizer": "standard",
                    "filter": ["lowercase"],
                },
            },
            "tokenizer": {
                "autocomplete_tokenizer": {
                    "type": "edge_ngram",
                    "min_gram": 2,
                    "max_gram": 20,
                    "token_chars": ["letter", "digit"],
                }
            },
        }
    },
    "mappings": {
        "properties": {
            "id": {"type": "keyword"},
            "name": {
                "type": "text",
                "analyzer": "autocomplete_analyzer",
                "search_analyzer": "autocomplete_search_analyzer",
                "fields": {
                    "keyword": {"type": "keyword"},
                    # Standard-analyzed sub-field used for fuzzy matching.
                    # Indexes whole words ("Multi", "Domex") not edge n-grams,
                    # so fuzziness compares full tokens and avoids false positives
                    # like "amul" ≈ edge-n-gram "mul" from "Multi-Purpose".
                    "text": {"type": "text", "analyzer": "standard"},
                },
            },
            "brand": {"type": "keyword"},
            "category": {"type": "keyword"},
            "subcategory": {"type": "keyword"},
            "price": {"type": "float"},
            "original_price": {"type": "float"},
            "discount_percent": {"type": "integer"},
            "rating": {"type": "float"},
            "in_stock": {"type": "boolean"},
            "delivery_time_mins": {"type": "integer"},
            "tags": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
            "description": {"type": "text"},
        }
    },
}


async def delete_index(es: AsyncElasticsearch) -> None:
    try:
        await es.indices.delete(index=INDEX_NAME)
        print(f"Deleted index: {INDEX_NAME}")
    except NotFoundError:
        print(f"Index {INDEX_NAME} does not exist, skipping delete.")


async def create_index(es: AsyncElasticsearch) -> None:
    await es.indices.create(index=INDEX_NAME, body=INDEX_MAPPING)
    print(f"Created index: {INDEX_NAME}")


async def bulk_index_products(es: AsyncElasticsearch) -> int:
    products = get_products()
    operations = []
    for product in products:
        operations.append({"index": {"_index": INDEX_NAME, "_id": product["id"]}})
        operations.append(product)

    response = await es.bulk(body=operations, refresh=True)

    if response.get("errors"):
        errors = [
            item for item in response["items"] if item.get("index", {}).get("error")
        ]
        print(f"Bulk indexing had {len(errors)} errors.")
    else:
        print(f"Successfully indexed {len(products)} products.")

    return len(products)


async def reset_index() -> int:
    es = get_es_client()
    await delete_index(es)
    await create_index(es)
    count = await bulk_index_products(es)
    return count
