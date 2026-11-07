---
title: "分页功能怎么设计成可复用组件"
date: 2026-08-12 22:10:00
cover: /img/covers/reusable-pagination.svg
top_img: /img/covers/reusable-pagination.svg
description: "拆成三块，每块只写一次：参数用 PageParams（依赖注入）、响应用 Page[T]（泛型外壳）、 查询用 paginate()（通用分页器）。之后每个列表…"
categories:
  - 后端
tags:
  - 分页
  - API设计
  - 工程实践
---

上级：00-首页 · 00-问题索引 · 相关：Q-26-还需要添加什么功能

> **📋 摘要：一句话结论**
> **拆成三块，每块只写一次**：参数用 `PageParams`（依赖注入）、响应用 `Page[T]`（泛型外壳）、
> 查询用 `paginate()`（通用分页器）。之后每个列表接口**只改 2 行**。

---

## 一、三块积木

**新建 `schema/common.py`** —— 参数 + 响应外壳：

```python
from typing import Generic, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

	class PageParams(BaseModel):
    page: int = Field(default=1, ge=1, description="页码，从 1 开始")
    size: int = Field(default=20, ge=1, le=100, description="每页条数")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size

class Page(BaseModel, Generic[T]):
    model_config = ConfigDict(from_attributes=True)   # ⭐ 必需，见坑 3
    items: list[T]
    total: int
    page: int
    size: int
    pages: int
```

**新建 `core/pagination.py`** —— 通用分页器：

```python
from dataclasses import dataclass
from typing import Generic, Sequence, TypeVar
from sqlalchemy import func, select
from schema.common import PageParams

T = TypeVar("T")

@dataclass(slots=True)
class PageResult(Generic[T]):
    items: Sequence[T]
    total: int
    page: int
    size: int

    @property
    def pages(self) -> int:
        return (self.total + self.size - 1) // self.size if self.size else 0

async def paginate(db, stmt, params: PageParams) -> PageResult:
    """任意 select 语句 → 分页结果。stmt 里带不带 where/order_by 都行。"""
    total = await db.scalar(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    )
    rows = await db.execute(stmt.limit(params.size).offset(params.offset))
    return PageResult(items=rows.scalars().all(), total=int(total or 0),
                      page=params.page, size=params.size)
```

> **💡 提示：为什么中间要多一个 `PageResult` dataclass**
> 因为服务层**不该知道响应模型长什么样**。`paginate()` 返回纯数据，
> 由路由的 `response_model=Page[StudentResponse]` 去校验和转换 ——
> 这样同一个 `paginate()` 能服务学生、课程、成绩、用户**四条链路**。
> 直接返回 `Page[T]` 也行，但那样服务层就得 import 每种 `XxxResponse`。

---

## 二、每个接口改哪 2 行

以学生模块为例（`server/student.py` + `router/student.py`）：

```python
# server/student.py —— 原来：async def get_students(db) -> list[Student]
async def get_students(db, params: PageParams) -> PageResult:
    return await paginate(db, select(Student).order_by(Student.student_id), params)
```

```python
# router/student.py —— 原来：response_model=list[StudentResponse]
@router.get("", response_model=Page[StudentResponse])
async def list_students(params: PageParams = Depends(), db: AsyncSession = Depends(get_db)):
    return await student_service.get_students(db, params)
```

四条链路全都这么改：`/api/student`、`/api/course`、`/api/score`、`/api/user/list`。

**返回体**：

```json
{ "items": [...], "total": 1283, "page": 1, "size": 20, "pages": 65 }
```

**调用**：`GET /api/score?page=2&size=50`

---

## 三、要加筛选怎么办 —— 继承即可

`PageParams` 是个普通 pydantic 模型，**继承就能长出新参数**，
`paginate()` 完全不用改：

```python
class StudentQuery(PageParams):
    clazz: str | None = Field(default=None, alias="class", description="按班级筛选")
    keyword: str | None = Field(default=None, description="学号/姓名模糊搜索")
    model_config = ConfigDict(populate_by_name=True)
```

```python
async def get_students(db, q: StudentQuery) -> PageResult:
    stmt = select(Student)
    if q.clazz:
        stmt = stmt.where(Student.clazz == q.clazz)      # 吃到 idx_class 索引
    if q.keyword:
        stmt = stmt.where(or_(Student.name.like(f"%{q.keyword}%"),
                              Student.student_id.like(f"%{q.keyword}%")))
    return await paginate(db, stmt.order_by(Student.student_id), q)
```

路由签名把 `PageParams` 换成 `StudentQuery` 就行。

---

## 四、实测结果（2026-09-17，只读跑真实库）

| #   | 场景                                                 | 结果                                  |
| :-- | :------------------------------------------------- | :---------------------------------- |
| 1   | `students` page=1/2/10, size=10                    | 各 10 条，`total=100`，`pages=10` ✅     |
| 2   | `students` page=**11**（越界）                         | **0 条，`total` 仍是 100** ✅            |
| 3   | `scores` page=1, size=20                           | `total=1283`，`pages=65` ✅           |
| 4   | stmt 带 `order_by` → count                          | `total=100`，与全表一致 ✅                 |
| 5   | `StudentQuery(class=...)` 筛选                       | `total=1`，筛选生效 ✅                    |
| 6   | `Page[StudentResponse].model_validate(PageResult)` | items=10、pages=10，ORM → 响应模型转换成功 ✅  |
| 7   | `Depends(PageParams)` 的签名解析                        | 解出 `['page', 'size']` 两个 query 参数 ✅ |

> 探针脚本放在项目外，跑完已删。**未改动任何项目源码，全部为读操作。**

---

## 五、五个坑

> **🚫 危险：1. `Page[XxxResponse]` 是**破坏性改动**，前端要同步改**
> 返回体从 `[...]`（数组）变成 `{items:[...]}`（对象）。
> 前端所有 `res.data.map(...)` 得改成 `res.data.items.map(...)`，
> `res.data.length` 得改成 `res.data.total`。
> **四条链路要么一次全改完，要么先加个 `?page=` 可选的新接口过渡**，
> 千万别一半分页一半不分页 —— 前端会写出两套渲染逻辑。

> **🚫 危险：2. `size` 必须设上限（`le=100`）**
> 否则 `?size=999999` 就等于没分页，1283 条照样一次全吐。
> 分页参数是**用户可控的**，不设上限等于把「全表返回」这个洞原样保留。

> **⚠️ 注意：3. `Page` 上的 `from_attributes=True` 不能省**
> 因为返回的是 `PageResult`（dataclass），不是 dict。
> 少了这个配置，pydantic 只会去找 `__getitem__`，报
> `items: Field required`。

> **⚠️ 注意：4. count 语句要用 `order_by(None)` 去掉排序**
> `select(func.count()).select_from(stmt.subquery())` 会把原 stmt 连同
> `ORDER BY` 一起塞进子查询。MySQL 能跑（实测 total 正确），但**排序是白做的开销** ——
> 数总数根本不需要有序，而成绩表 1283 条按 `(student_id, course_id)` 排一遍并不便宜。

> **⚠️ 注意：5. 越界页返回 **200 + 空数组**，不要返回 404**
> 实测 `page=999` → `{"items":[], "total":100, "pages":5}`。
> 这是分页接口的通行约定：页码越界不是「资源不存在」，
> 404 会让前端错误处理分支误判成「接口挂了」。

---

## 六、落地顺序建议```mermaidflowchart LR
    A["① 建 schema/common.py<br/>+ core/pagination.py"] --> B["② 先改 /api/score<br/>（1283 条，最疼的）"]
    B --> C["③ 再改 student/course"]
    C --> D["④ 最后改 /api/user/list<br/>（14 条，改不改都行）"]
```

> **💡 提示：别一次全改**
> 先拿 `/api/score` 试 —— 它是唯一「不分页真的会疼」的接口，
> 改完能立刻验证正确性。跑通了再复制到其它三条。

---

## 相关笔记

- Q-26-还需要添加什么功能 — 分页在缺口清单里排第二梯队
- Q-12-按班级统计不及格率 — 同样是「一次查出聚合结果」的写法
- 分层架构约定 — 为什么 `paginate()` 放 `core/` 而不是 `server/`
- 接口总览 — 改完后这里的分页契约要同步更新

> **📝 说明：本篇代码均已实测**
> 环境：Python 3.14.0 / pydantic 2.13.5 / SQLAlchemy 2.0.52 / FastAPI 0.141。
