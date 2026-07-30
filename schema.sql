-- Одна таблица: справочники category/city вынести некуда — 22 категории и 20 городов
create table if not exists companies (
    id            text primary key,                       
    name          text not null,
    category      text,
    city          text,
    address       text,
    rating        numeric(2,1) check (rating >= 0 and rating <= 5),
    reviews_count integer not null default 0 check (reviews_count >= 0),
    site          text,
    phone         text
);

-- Индексы под запросы из queries.sql
create index if not exists companies_category_idx on companies (category);
create index if not exists companies_city_rating_idx on companies (city, rating)
    where reviews_count >= 10 and rating is not null;
