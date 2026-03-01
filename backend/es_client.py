import os
from urllib.parse import urlparse

from elasticsearch import AsyncElasticsearch

ES_HOST = os.getenv("ES_HOST", "http://localhost:9200")

_client: AsyncElasticsearch | None = None


def get_es_client() -> AsyncElasticsearch:
    global _client
    if _client is None:
        parsed = urlparse(ES_HOST)
        if parsed.username and parsed.password:
            # Bonsai (and other managed ES) embed credentials in the URL.
            # elasticsearch-py v8 requires them passed separately via basic_auth;
            # passing user:pass@host as a plain URL string is not reliably parsed.
            host_only = f"{parsed.scheme}://{parsed.hostname}"
            if parsed.port:
                host_only += f":{parsed.port}"
            _client = AsyncElasticsearch(
                hosts=[host_only],
                http_auth=(parsed.username, parsed.password),  # v7 param (basic_auth is v8 only)
                request_timeout=30,
                retry_on_timeout=True,
                max_retries=3,
            )
        else:
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
