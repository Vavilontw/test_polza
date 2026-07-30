-- 1. Топ-5 категорий по числу компаний
select category,
       count(*) as companies
from companies
group by category
order by companies desc, category
limit 5;

-- 2. Средний рейтинг по городам среди компаний с 10+ отзывами
select city,
       round(avg(rating), 2) as avg_rating,
       count(*)              as companies
from companies
where reviews_count >= 10
  and rating is not null
group by city
order by avg_rating desc, city;

-- 3. Доля компаний с сайтом по категориям
select category,
       count(*)                                  as total,
       count(site)                               as with_site,
       round(100.0 * count(site) / count(*), 1)  as pct_with_site
from companies
group by category
order by pct_with_site desc, category;
