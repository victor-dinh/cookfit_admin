import type { Timestamp } from 'firebase/firestore'

export type LocalizedText = {
  vi: string
  en: string
}

export type RecipeDocument = {
  id: string
  title: LocalizedText
  description: LocalizedText
  ingredients: { vi: string[]; en: string[] }
  steps: { vi: string[]; en: string[] }
  category: string
  appliance: string
  cooking_time: number | string
  difficulty?: string
  featured: boolean
  isActive: boolean
  order?: number
  boxKey?: string
  sectionTitleVi?: string
  sectionTitleEn?: string
  imageUrl?: string
  imagePath?: string
  imageVersion?: number
  image_key?: string
  main_ingredients?: string[]
  required_ingredients?: string[]
  optional_ingredients?: string[]
  sourceName?: string
  sourceUrl?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
  publishedAt?: Timestamp
}

export type RecipeForm = {
  id: string
  titleVi: string
  titleEn: string
  descriptionVi: string
  descriptionEn: string
  ingredientsVi: string
  ingredientsEn: string
  stepsVi: string
  stepsEn: string
  category: string
  appliance: string
  cookingTime: string
  difficulty: string
  featured: boolean
  isActive: boolean
  order: string
  boxKey: string
  sectionTitleVi: string
  sectionTitleEn: string
  imageUrl: string
  imagePath: string
  imageVersion: number
  imageKey: string
  mainIngredients: string
  requiredIngredients: string
  optionalIngredients: string
  sourceName: string
  sourceUrl: string
}

export const emptyRecipeForm = (): RecipeForm => ({
  id: '',
  titleVi: '',
  titleEn: '',
  descriptionVi: '',
  descriptionEn: '',
  ingredientsVi: '',
  ingredientsEn: '',
  stepsVi: '',
  stepsEn: '',
  category: 'other',
  appliance: 'Bếp',
  cookingTime: '30',
  difficulty: 'easy',
  featured: false,
  isActive: false,
  order: '',
  boxKey: '',
  sectionTitleVi: '',
  sectionTitleEn: '',
  imageUrl: '',
  imagePath: '',
  imageVersion: 0,
  imageKey: '',
  mainIngredients: '',
  requiredIngredients: '',
  optionalIngredients: '',
  sourceName: '',
  sourceUrl: '',
})
