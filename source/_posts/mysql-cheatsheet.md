---
title: "MySQL 常用语句速查手册"
date: 2026-01-27 22:00:00
cover: /img/covers/infra-server.jpg
top_img: /img/covers/infra-server.jpg
description: "本文档汇总MySQL日常开发、面试高频使用语句，包含数据库操作、数据表操作、增删改查、条件查询、排序分页、聚合分组、多表连接、索引、时间函数、事务等核心内容，所…"
categories:
  - 后端
tags:
  - MySQL
  - SQL
  - 速查
---

本文档汇总MySQL日常开发、面试高频使用语句，包含数据库操作、数据表操作、增删改查、条件查询、排序分页、聚合分组、多表连接、索引、时间函数、事务等核心内容，所有语句附带详细注释，可直接复制使用。

## 一、数据库操作语句

针对数据库的创建、查看、选中、删除基础操作

```sql
-- 查看所有数据库
SHOW DATABASES;

-- 创建数据库（基础版）
CREATE DATABASE db_name;

-- 安全创建数据库（不存在则创建，指定utf8mb4通用字符集）
CREATE DATABASE IF NOT EXISTS db_name DEFAULT CHARACTER SET utf8mb4;

-- 选中/使用指定数据库
USE db_name;

-- 查看当前正在使用的数据库
SELECT DATABASE();

-- 安全删除数据库（存在则删除）
DROP DATABASE IF EXISTS db_name;
```

## 二、数据表操作语句

包含数据表创建、查看结构、修改字段、重命名、删除表等操作

```sql
-- 查看当前库下所有数据表
SHOW TABLES;

-- 快速查看表结构
DESC table_name;
DESCRIBE table_name;

-- 【核心】创建数据表（含主键、自增、默认值、注释、引擎字符集）
CREATE TABLE student(
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键id',
    name VARCHAR(20) NOT NULL COMMENT '姓名',
    age INT COMMENT '年龄',
    gender TINYINT DEFAULT 1 COMMENT '性别 1-男 2-女',
    create_time DATETIME DEFAULT NOW() COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生信息表';

-- 修改数据表名称
ALTER TABLE old_table_name RENAME TO new_table_name;

-- 新增数据表字段
ALTER TABLE student ADD COLUMN email VARCHAR(50) COMMENT '邮箱';

-- 修改字段数据类型（不修改字段名）
ALTER TABLE student MODIFY COLUMN age TINYINT COMMENT '年龄';

-- 修改字段名+数据类型
ALTER TABLE student CHANGE COLUMN email mail VARCHAR(60) COMMENT '个人邮箱';

-- 删除数据表指定字段
ALTER TABLE student DROP COLUMN mail;

-- 安全删除数据表
DROP TABLE IF EXISTS student;

-- 查看数据表建表语句
SHOW CREATE TABLE student;
```

## 三、数据增删改（DML 核心操作）

### 1\. 数据插入 INSERT```sql
-- 指定字段插入单条数据
INSERT INTO student(name,age) VALUES ('张三',18);

-- 批量插入多条数据（高效写法）
INSERT INTO student(name,age,gender) 
VALUES ('李四',19,1),('王五',20,2),('赵六',17,1);

-- 全字段插入（必须给所有字段按顺序赋值）
INSERT INTO student VALUES(4,'孙七',22,1,'2026-01-01 10:00:00');
```

### 2\. 数据更新 UPDATE（重要：必须加WHERE，否则全表更新）```sql
-- 单字段更新
UPDATE student SET age=21 WHERE id=1;

-- 多字段同时更新
UPDATE student SET age=22,name='小张' WHERE id=2;
```

### 3\. 数据删除 DELETE/TRUNCATE```sql
-- 删除指定条件数据
DELETE FROM student WHERE id=3;

-- 删除表中所有数据（自增主键不重置，可事务回滚）
DELETE FROM student;

-- 清空整张表（速度快、重置自增主键、不可回滚、不触发事务）
TRUNCATE TABLE student;
```

## 四、数据查询（SELECT 最常用核心）

### 1\. 基础查询```sql
-- 查询表中所有字段所有数据
SELECT * FROM student;

-- 查询指定字段数据
SELECT id,name,age FROM student;

-- 字段别名查询（美化返回结果）
SELECT id AS 编号, name 姓名, age 年龄 FROM student;

-- 去重查询（剔除重复数据）
SELECT DISTINCT age FROM student;
```

### 2\. 条件查询 WHERE```sql
-- 基础比较运算
SELECT * FROM student WHERE age = 18; -- 等于
SELECT * FROM student WHERE age > 18; -- 大于
SELECT * FROM student WHERE age < 25; -- 小于

-- 多条件组合 AND / OR
SELECT * FROM student WHERE age>17 AND age<25; -- 且
SELECT * FROM student WHERE age<18 OR age>30; -- 或

-- 区间查询（闭区间，包含首尾数值）
SELECT * FROM student WHERE age BETWEEN 18 AND 22;

-- 集合范围查询
SELECT * FROM student WHERE id IN (1,3,5);

-- 模糊查询 %匹配任意字符 _匹配单个字符
SELECT * FROM student WHERE name LIKE '张%'; -- 以张开头
SELECT * FROM student WHERE name LIKE '_三'; -- 第二个字为三

-- NULL值判断（严禁使用=NULL）
SELECT * FROM student WHERE age IS NULL; -- 查询为空的数据
SELECT * FROM student WHERE age IS NOT NULL; -- 查询非空数据
```

### 3\. 排序查询 ORDER BY```sql
-- ASC 升序（默认可不写），DESC 降序
SELECT * FROM student ORDER BY age ASC; -- 年龄升序
SELECT * FROM student ORDER BY age DESC, id DESC; -- 年龄降序，年龄相同则ID降序
```

### 4\. 分页查询 LIMIT```sql
-- 语法：LIMIT 偏移量, 每页条数 （偏移量从0开始）
SELECT * FROM student LIMIT 0,10; -- 第1页，10条数据
SELECT * FROM student LIMIT 10,10; -- 第2页，10条数据
SELECT * FROM student LIMIT 20; -- 只取前20条数据
```

## 五、聚合函数统计

常用于数据统计、报表查询，搭配分组使用

```sql
-- 常用聚合函数
COUNT(*)   -- 统计总行数（推荐）
SUM(age)   -- 字段求和
AVG(age)   -- 计算平均值
MAX(age)   -- 查询最大值
MIN(age)   -- 查询最小值

-- 组合使用示例
SELECT 
    COUNT(*) 总人数, 
    AVG(age) 平均年龄,
    MAX(age) 最大年龄,
    MIN(age) 最小年龄,
    SUM(age) 年龄总和
FROM student;
```

## 六、分组查询 GROUP BY

核心规则：WHERE 过滤原始数据（分组前），HAVING 过滤分组结果（分组后，支持聚合函数）

```sql
-- 按性别分组，统计每组人数
SELECT gender,COUNT(*) 人数 FROM student GROUP BY gender;

-- 分组后条件过滤：只展示人数大于2的分组
SELECT gender,COUNT(*) 人数 
FROM student 
GROUP BY gender 
HAVING 人数>2;
```

## 七、多表连接查询

适用于关联多张数据表查询数据，分为内连接、左连接、右连接

### 1\. 内连接 INNER JOIN

只返回两张表中匹配成功的数据，匹配不到则不展示

```sql
SELECT s.name,c.course_name
FROM student s
INNER JOIN course c ON s.course_id = c.id;
```

### 2\. 左连接 LEFT JOIN（开发最常用）

以左表为基准，左表数据全部展示，右表无匹配数据则显示NULL

```sql
SELECT s.name,c.course_name
FROM student s
LEFT JOIN course c ON s.course_id = c.id;
```

### 3\. 右连接 RIGHT JOIN

以右表为基准，右表数据全部展示，左表无匹配数据则显示NULL

```sql
SELECT s.name,c.course_name
FROM student s
RIGHT JOIN course c ON s.course_id = c.id;
```

## 八、索引操作语句

索引用于优化查询速度，提升数据库性能

```sql
-- 查看表所有索引
SHOW INDEX FROM student;

-- 创建普通索引
CREATE INDEX idx_stu_name ON student(name);

-- 创建唯一索引（字段值唯一，不允许重复）
CREATE UNIQUE INDEX idx_stu_idcard ON student(id_card);

-- 删除索引
DROP INDEX idx_stu_name ON student;
```

## 九、常用时间函数```sql
SELECT NOW();        -- 获取当前完整日期时间
SELECT CURDATE();    -- 获取当前日期（仅年月日）
SELECT CURTIME();    -- 获取当前时间（仅时分秒）
SELECT DATE(NOW());  -- 提取日期部分
SELECT YEAR(NOW());  -- 提取年份
SELECT MONTH(NOW()); -- 提取月份
SELECT DAY(NOW());   -- 提取日期天数
```

## 十、事务操作语句

事务保证数据一致性，支持原子性、一致性、隔离性、持久性，多用于转账、订单等核心业务

```sql
START TRANSACTION; -- 开启事务
-- 执行多条数据库操作语句
UPDATE user SET money=money-100 WHERE id=1;
UPDATE user SET money=money+100 WHERE id=2;
COMMIT;  -- 提交事务（数据永久生效）
ROLLBACK; -- 回滚事务（撤销所有操作，数据恢复原样）
```

## 十一、常用辅助语句```sql
-- 查看MySQL版本
SELECT VERSION();

-- 查看数据库字符集配置
SHOW VARIABLES LIKE '%character%';

-- 查看数据库存储引擎
SHOW ENGINES;
```

> （注：部分内容可能由 AI 生成）
