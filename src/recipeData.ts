import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase'
import type { RecipeDocument, RecipeForm } from './types'

const lines = (value: string) => value
  .split('\n')
  .map((item) => item.trim().replace(/^\d+[.)]\s*/, '').replace(/^[-•]\s*/, ''))
  .filter(Boolean)

const localizedText = (value: unknown) => {
  if (typeof value === 'string') return { vi: value, en: value }
  const map = (value ?? {}) as Record<string, unknown>
  return {
    vi: String(map.vi ?? map.en ?? ''),
    en: String(map.en ?? map.vi ?? ''),
  }
}

const localizedList = (value: unknown) => {
  if (Array.isArray(value)) {
    const items = value.map(String)
    return { vi: items, en: items }
  }
  const map = (value ?? {}) as Record<string, unknown>
  const vi = Array.isArray(map.vi) ? map.vi.map(String) : []
  const en = Array.isArray(map.en) ? map.en.map(String) : []
  return { vi: vi.length ? vi : en, en: en.length ? en : vi }
}

const optionalString = (value: unknown) => typeof value === 'string' ? value : ''
const optionalStringList = (value: unknown) => Array.isArray(value) ? value.map(String) : []

export function subscribeRecipes(
  onData: (recipes: RecipeDocument[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(collection(db, 'recipes'), (snapshot) => {
    const recipes = snapshot.docs.map((item) => fromFirestore(item.id, item.data()))
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER
        if (orderA !== orderB) return orderA - orderB
        return a.title.vi.localeCompare(b.title.vi, 'vi')
      })
    onData(recipes)
  }, (error) => onError(error))
}

function fromFirestore(id: string, data: DocumentData): RecipeDocument {
  return {
    id,
    title: localizedText(data.title ?? data.recipe_name ?? data.recipeName),
    description: localizedText(data.description),
    ingredients: localizedList(data.ingredients ?? data.ingredients_list),
    steps: localizedList(data.steps),
    category: optionalString(data.category ?? data.food_tag ?? data.foodTag),
    appliance: optionalString(data.appliance ?? data.appliance_used ?? data.applianceUsed),
    cooking_time: data.cooking_time ?? data.cookingTime ?? '',
    difficulty: optionalString(data.difficulty),
    featured: data.featured === true,
    isActive: data.isActive === true || data.is_active === true,
    order: typeof data.order === 'number' ? data.order : undefined,
    boxKey: optionalString(data.boxKey ?? data.box_key),
    sectionTitleVi: optionalString(data.sectionTitleVi ?? data.section_title_vi),
    sectionTitleEn: optionalString(data.sectionTitleEn ?? data.section_title_en),
    imageUrl: optionalString(data.imageUrl ?? data.image_url),
    imagePath: optionalString(data.imagePath ?? data.image_path),
    imageVersion: typeof data.imageVersion === 'number' ? data.imageVersion : 0,
    image_key: optionalString(data.image_key ?? data.imageKey),
    main_ingredients: optionalStringList(data.main_ingredients ?? data.mainIngredients),
    required_ingredients: optionalStringList(data.required_ingredients ?? data.requiredIngredients),
    optional_ingredients: optionalStringList(data.optional_ingredients ?? data.optionalIngredients),
    sourceName: optionalString(data.sourceName ?? data.source_name),
    sourceUrl: optionalString(data.sourceUrl ?? data.source_url),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    publishedAt: data.publishedAt,
  }
}

export function recipeToForm(recipe: RecipeDocument): RecipeForm {
  return {
    id: recipe.id,
    titleVi: recipe.title.vi,
    titleEn: recipe.title.en,
    descriptionVi: recipe.description.vi,
    descriptionEn: recipe.description.en,
    ingredientsVi: recipe.ingredients.vi.join('\n'),
    ingredientsEn: recipe.ingredients.en.join('\n'),
    stepsVi: recipe.steps.vi.join('\n'),
    stepsEn: recipe.steps.en.join('\n'),
    category: recipe.category || 'other',
    appliance: recipe.appliance || 'Bếp',
    cookingTime: String(recipe.cooking_time ?? ''),
    difficulty: recipe.difficulty || 'easy',
    featured: recipe.featured,
    isActive: recipe.isActive,
    order: recipe.order == null ? '' : String(recipe.order),
    boxKey: recipe.boxKey || '',
    sectionTitleVi: recipe.sectionTitleVi || '',
    sectionTitleEn: recipe.sectionTitleEn || '',
    imageUrl: recipe.imageUrl || '',
    imagePath: recipe.imagePath || '',
    imageVersion: recipe.imageVersion || 0,
    imageKey: recipe.image_key || '',
    mainIngredients: recipe.main_ingredients?.join('\n') || '',
    requiredIngredients: recipe.required_ingredients?.join('\n') || '',
    optionalIngredients: recipe.optional_ingredients?.join('\n') || '',
    sourceName: recipe.sourceName || '',
    sourceUrl: recipe.sourceUrl || '',
  }
}

export function validateRecipe(form: RecipeForm) {
  const errors: string[] = []
  if (!form.titleVi.trim() || !form.titleEn.trim()) errors.push('Cần đủ tên món tiếng Việt và tiếng Anh.')
  if (!form.descriptionVi.trim() || !form.descriptionEn.trim()) errors.push('Cần đủ mô tả song ngữ.')
  if (!lines(form.ingredientsVi).length || !lines(form.ingredientsEn).length) errors.push('Cần danh sách nguyên liệu song ngữ.')
  if (!lines(form.stepsVi).length || !lines(form.stepsEn).length) errors.push('Cần các bước nấu song ngữ.')
  if (!form.category.trim() || !form.appliance.trim() || !form.cookingTime.trim()) errors.push('Cần loại món, thiết bị và thời gian nấu.')
  if (form.isActive && !form.imageUrl && !form.imageKey) errors.push('Món xuất bản cần ảnh upload hoặc ảnh dự phòng.')
  return errors
}

export async function saveRecipe(form: RecipeForm, publish: boolean) {
  const recipeRef = form.id ? doc(db, 'recipes', form.id) : doc(collection(db, 'recipes'))
  const payload = {
    title: { vi: form.titleVi.trim(), en: form.titleEn.trim() },
    description: { vi: form.descriptionVi.trim(), en: form.descriptionEn.trim() },
    ingredients: { vi: lines(form.ingredientsVi), en: lines(form.ingredientsEn) },
    steps: { vi: lines(form.stepsVi), en: lines(form.stepsEn) },
    category: form.category.trim(),
    appliance: form.appliance.trim(),
    cooking_time: Number(form.cookingTime) || form.cookingTime.trim(),
    difficulty: form.difficulty,
    featured: form.featured,
    isActive: publish,
    order: form.order ? Number(form.order) : null,
    boxKey: form.boxKey || null,
    sectionTitleVi: form.sectionTitleVi.trim() || null,
    sectionTitleEn: form.sectionTitleEn.trim() || null,
    imageUrl: form.imageUrl || null,
    imagePath: form.imagePath || null,
    imageVersion: form.imageVersion || 0,
    image_key: form.imageKey.trim() || null,
    main_ingredients: lines(form.mainIngredients),
    required_ingredients: lines(form.requiredIngredients),
    optional_ingredients: lines(form.optionalIngredients),
    sourceName: form.sourceName.trim() || null,
    sourceUrl: form.sourceUrl.trim() || null,
    updatedAt: serverTimestamp(),
    ...(form.id ? {} : { createdAt: serverTimestamp() }),
    ...(publish ? { publishedAt: serverTimestamp() } : {}),
  }

  await setDoc(recipeRef, payload, { merge: true })
  await setDoc(doc(db, 'content_meta', 'recipes'), {
    version: increment(1),
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return recipeRef.id
}

export async function removeRecipe(id: string) {
  await deleteDoc(doc(db, 'recipes', id))
  await setDoc(doc(db, 'content_meta', 'recipes'), {
    version: increment(1),
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function uploadRecipeImage(recipeId: string, file: File) {
  const blob = await cropImageToWebp(file)
  const path = `recipe-images/${recipeId || 'drafts'}/${crypto.randomUUID()}.webp`
  const imageRef = ref(storage, path)
  await uploadBytes(imageRef, blob, {
    contentType: 'image/webp',
    cacheControl: 'public,max-age=31536000,immutable',
  })
  return { imageUrl: await getDownloadURL(imageRef), imagePath: path }
}

async function cropImageToWebp(file: File): Promise<Blob> {
  const image = await createImageBitmap(file)
  const targetWidth = 1600
  const targetHeight = 900
  const sourceRatio = image.width / image.height
  const targetRatio = targetWidth / targetHeight
  let sx = 0
  let sy = 0
  let sw = image.width
  let sh = image.height
  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio
    sx = (image.width - sw) / 2
  } else {
    sh = image.width / targetRatio
    sy = (image.height - sh) / 2
  }
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Không thể xử lý ảnh trên trình duyệt này.')
  context.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
  image.close()
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Không thể tạo ảnh WebP.')),
    'image/webp',
    0.86,
  ))
}
