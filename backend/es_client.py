import os
from elasticsearch import AsyncElasticsearch

ES_HOST = os.getenv("ES_HOST", "http://localhost:9200")

_client: AsyncElasticsearch | None = None


def get_es_client() -> AsyncElasticsearch:
    global _client
    if _client is None:
        _client = AsyncElasticsearch(
            hosts=[ES_HOST],
            request_timeout=30,
            retry_on_timeout=True,
            max_retries=3,
        )
    return _client


async def close_es_client() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
