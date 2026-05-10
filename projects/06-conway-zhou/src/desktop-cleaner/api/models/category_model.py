from pydantic import BaseModel
from typing import List


class CategoryList(BaseModel):
    categories: List[str]


class CategoryUpdate(BaseModel):
    categories: List[str]
