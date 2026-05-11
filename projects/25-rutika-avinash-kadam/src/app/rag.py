from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from app.config import embeddings
from app.prompts import SYSTEM_PROMPT

# In-memory vector store — cleared on reset or server restart
vector_store: FAISS | None = None


def index_text(text: str) -> int:
    global vector_store
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text(text)
    vector_store = FAISS.from_texts(chunks, embeddings)
    return len(chunks)


def clear_vector_store() -> None:
    global vector_store
    vector_store = None


def retrieve_context(query: str) -> str:
    if vector_store is None:
        return ""
    docs = vector_store.similarity_search(query, k=4)
    return "\n".join(d.page_content for d in docs) if docs else ""


def build_system_prompt(query: str) -> str:
    context = retrieve_context(query)
    if context:
        return SYSTEM_PROMPT + f"\n\nRelevant variable/study context from the data dictionary:\n{context}"
    return SYSTEM_PROMPT
