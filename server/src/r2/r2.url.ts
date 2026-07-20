/**
 * Публічний URL картинки будуємо з ключа, а не зберігаємо в БД: зміна
 * домену чи бакета не має вимагати переписування рядків у базі.
 *
 * Ключі й base URL — єдине, що назовні; секрети R2 сюди не потрапляють.
 */
export function buildImageUrl(imageKey: string | null | undefined): string | null {
  if (!imageKey) return null;
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/${imageKey.replace(/^\/+/, '')}`;
}

/** Категорія у вигляді, який віддаємо клієнту. */
export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
}

type CategoryLike = { id: string; slug: string; name: string; imageKey: string | null };

export function toCategoryDto(c: CategoryLike | null | undefined): CategoryDto | null {
  if (!c) return null;
  return { id: c.id, slug: c.slug, name: c.name, imageUrl: buildImageUrl(c.imageKey) };
}
