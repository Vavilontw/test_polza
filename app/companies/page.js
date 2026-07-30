import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PER_PAGE = 25;

// Фильтр один и тот же для count и для страницы данных
const WHERE = `where ($1 = '' or name ilike '%' || $1 || '%')
                 and ($2 = '' or city = $2)`;

export default async function CompaniesPage({ searchParams }) {
  const { q = "", city = "", page = "1" } = await searchParams;

  const [{ rows: [{ total }] }, { rows: cities }] = await Promise.all([
    pool.query(`select count(*)::int as total from companies ${WHERE}`, [q, city]),
    pool.query("select distinct city from companies order by city"),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);  // ?page=0, =abc, =999 -> в границы

  const { rows: companies } = await pool.query(
    `select id, name, category, city, address, rating, reviews_count, site
       from companies
      ${WHERE}
      order by reviews_count desc, name
      limit $3 offset $4`,
    [q, city, PER_PAGE, (current - 1) * PER_PAGE],
  );

  const pageHref = (p) =>
    `/companies?${new URLSearchParams({ ...(q && { q }), ...(city && { city }), page: p })}`;

  // Первая, последняя и соседи текущей: при 48 страницах полный список не нужен
  const shown = [...new Set([1, current - 1, current, current + 1, pages])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b);

  return (
    <main>
      <h1>Компании</h1>

      <form>
        <input name="q" defaultValue={q} placeholder="Поиск по названию" />
        <select name="city" defaultValue={city}>
          <option value="">Все города</option>
          {cities.map((c) => (
            <option key={c.city}>{c.city}</option>
          ))}
        </select>
        <button type="submit">Найти</button>
        {(q || city) && <a className="reset" href="/companies">Сбросить</a>}
      </form>

      <p className="found">
        Найдено: {total}
        {pages > 1 && ` · страница ${current} из ${pages}`}
      </p>

      {companies.length === 0 ? <p>Ничего не найдено — попробуйте другой запрос или город.</p> : (
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Категория</th>
            <th>Город</th>
            <th>Адрес</th>
            <th className="num">Рейтинг</th>
            <th className="num">Отзывы</th>
            <th>Сайт</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.category}</td>
              <td>{c.city}</td>
              <td>{c.address}</td>
              <td className="num">{c.rating ?? "—"}</td>
              <td className="num">{c.reviews_count}</td>
              <td>{c.site ? <a href={c.site}>сайт</a> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}

      {pages > 1 && (
        <nav className="pages">
          {current > 1
            ? <a href={pageHref(current - 1)}>← Назад</a>
            : <span className="off">← Назад</span>}
          {shown.map((p, i) => (
            <span key={p} className="slot">
              {i > 0 && p - shown[i - 1] > 1 && <span className="gap">…</span>}
              {p === current
                ? <span className="here">{p}</span>
                : <a href={pageHref(p)}>{p}</a>}
            </span>
          ))}
          {current < pages
            ? <a href={pageHref(current + 1)}>Вперёд →</a>
            : <span className="off">Вперёд →</span>}
        </nav>
      )}
    </main>
  );
}
