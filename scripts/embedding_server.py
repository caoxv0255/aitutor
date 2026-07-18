"""
本地 Embedding 服务 - OpenAI 兼容接口
用于 GraphRAG 的 embedding 需求
"""
import os
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()

model_name = os.environ.get("EMBEDDING_MODEL", "shibing624/text2vec-base-chinese")
print(f"加载模型: {model_name}")
model = SentenceTransformer(model_name)


class EmbeddingRequest(BaseModel):
    input: str | list[str]
    model: str | None = None
    dimensions: int | None = None


class EmbeddingItem(BaseModel):
    object: str = "embedding"
    embedding: list[float]
    index: int


class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: list[EmbeddingItem]
    model: str
    usage: dict = {"prompt_tokens": 0, "total_tokens": 0}


@app.post("/v1/embeddings")
async def create_embedding(req: EmbeddingRequest):
    inputs = req.input if isinstance(req.input, list) else [req.input]
    
    embeddings = model.encode(inputs, show_progress_bar=False)
    
    data = [
        EmbeddingItem(
            object="embedding",
            embedding=emb.tolist(),
            index=i
        )
        for i, emb in enumerate(embeddings)
    ]
    
    return EmbeddingResponse(
        data=data,
        model=model_name
    )


@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [{
            "id": model_name,
            "object": "model",
            "owned_by": "local",
            "permission": []
        }]
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Embedding 服务启动在 http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
