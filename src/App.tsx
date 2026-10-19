import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, Check, ChefHat, ChevronLeft, CircleAlert, Clock3, FilePenLine,
  ImagePlus, LayoutDashboard, LoaderCircle, LogOut, MoreHorizontal, Plus,
  Search, Sparkles, Trash2, Upload, Utensils, X,
} from 'lucide-react'
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User,
} from 'firebase/auth'
import { auth } from './firebase'
import {
  recipeToForm, removeRecipe, saveRecipe, subscribeRecipes,
  uploadRecipeImage, validateRecipe,
} from './recipeData'
import { emptyRecipeForm, type RecipeDocument, type RecipeForm } from './types'
import './App.css'

type Notice = { type: 'success' | 'error'; message: string } | null

const categoryOptions = [
  ['rice', 'Cơm'], ['noodles', 'Mì / Bún'], ['chicken', 'Gà'],
  ['meat', 'Thịt'], ['seafood', 'Hải sản'], ['eggs', 'Trứng'],
  ['vegetable', 'Rau củ'], ['soup', 'Canh / Súp'], ['dessert', 'Tráng miệng'],
  ['snack', 'Món ăn nhẹ'], ['other', 'Khác'],
]

// Dùng chung nhãn nhóm nội dung cho biểu mẫu và bộ lọc danh sách.
const boxOptions = [
  ['eat_clean_today', 'Eat clean hôm nay'],
  ['light_dinner', 'Bữa tối nhẹ nhàng'],
] as const

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [recipes, setRecipes] = useState<RecipeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all')
  const [boxFilter, setBoxFilter] = useState('all')
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured' | 'regular'>('all')
  const [editing, setEditing] = useState<RecipeForm | null>(null)
  const [activeLanguage, setActiveLanguage] = useState<'vi' | 'en'>('vi')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [authError, setAuthError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser)
    setAuthReady(true)
  }), [])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    return subscribeRecipes(
      (nextRecipes) => {
        setRecipes(nextRecipes)
        setLoading(false)
      },
      (error) => {
        setNotice({ type: 'error', message: friendlyFirebaseError(error) })
        setLoading(false)
      },
    )
  }, [user])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Hiện cả nhóm đang có trong Firestore, kể cả các boxKey được thêm từ nguồn khác.
  const boxFilterOptions = useMemo(() => {
    const options = new Map<string, string>(boxOptions)
    recipes.forEach((recipe) => {
      if (recipe.boxKey && !options.has(recipe.boxKey)) {
        options.set(recipe.boxKey, recipe.boxKey)
      }
    })
    return Array.from(options)
  }, [recipes])

  const filteredRecipes = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    return recipes.filter((recipe) => {
      const matchesStatus = status === 'all' || (status === 'published' ? recipe.isActive : !recipe.isActive)
      const matchesBox = boxFilter === 'all' || (boxFilter === 'unassigned' ? !recipe.boxKey : recipe.boxKey === boxFilter)
      const matchesFeatured = featuredFilter === 'all' || (featuredFilter === 'featured' ? recipe.featured : !recipe.featured)
      const matchesSearch = !keyword || [
        recipe.title.vi, recipe.title.en, recipe.category, recipe.appliance,
      ].some((value) => value.toLocaleLowerCase('vi').includes(keyword))
      return matchesStatus && matchesBox && matchesFeatured && matchesSearch
    })
  }, [recipes, search, status, boxFilter, featuredFilter])

  const hasActiveFilters = Boolean(search.trim()) || status !== 'all' || boxFilter !== 'all' || featuredFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setBoxFilter('all')
    setFeaturedFilter('all')
  }

  const publishedCount = recipes.filter((recipe) => recipe.isActive).length
  const draftCount = recipes.length - publishedCount

  const login = async () => {
    setAuthError('')
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (error) {
      setAuthError(friendlyFirebaseError(error as Error))
    }
  }

  const updateForm = <K extends keyof RecipeForm>(key: K, value: RecipeForm[K]) => {
    setEditing((current) => current ? { ...current, [key]: value } : current)
  }

  const submit = async (publish: boolean) => {
    if (!editing) return
    const next = { ...editing, isActive: publish }
    const errors = validateRecipe(next)
    if (errors.length) {
      setNotice({ type: 'error', message: errors[0] })
      return
    }
    setSaving(true)
    try {
      const id = await saveRecipe(next, publish)
      setEditing((current) => current ? { ...current, id, isActive: publish } : current)
      setNotice({
        type: 'success',
        message: publish ? 'Đã xuất bản. App sẽ nhận phiên bản content mới.' : 'Đã lưu bản nháp.',
      })
    } catch (error) {
      setNotice({ type: 'error', message: friendlyFirebaseError(error as Error) })
    } finally {
      setSaving(false)
    }
  }

  const uploadImage = async (file: File) => {
    if (!editing) return
    if (!file.type.startsWith('image/')) {
      setNotice({ type: 'error', message: 'Vui lòng chọn một file ảnh.' })
      return
    }
    setUploading(true)
    try {
      const image = await uploadRecipeImage(editing.id, file)
      setEditing((current) => current ? {
        ...current,
        ...image,
        imageVersion: Date.now(),
      } : current)
      setNotice({ type: 'success', message: 'Ảnh đã được cắt 16:9, tối ưu WebP và tải lên.' })
    } catch (error) {
      setNotice({ type: 'error', message: friendlyFirebaseError(error as Error) })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const deleteCurrent = async () => {
    if (!editing?.id) return
    if (!window.confirm(`Xóa vĩnh viễn “${editing.titleVi || editing.titleEn}”?`)) return
    setSaving(true)
    try {
      await removeRecipe(editing.id)
      setEditing(null)
      setNotice({ type: 'success', message: 'Đã xóa công thức.' })
    } catch (error) {
      setNotice({ type: 'error', message: friendlyFirebaseError(error as Error) })
    } finally {
      setSaving(false)
    }
  }

  if (!authReady) return <FullPageLoader />
  if (!user) return <LoginScreen onLogin={login} error={authError} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ChefHat size={24} strokeWidth={2.2} /></div>
          <div><strong>CookFit</strong><span>Content Studio</span></div>
        </div>
        <nav className="side-nav" aria-label="Điều hướng chính">
          <button className="nav-item active"><Utensils size={19} /> Công thức <span>{recipes.length}</span></button>
          <button className="nav-item" disabled><LayoutDashboard size={19} /> Tổng quan</button>
          <button className="nav-item" disabled><Archive size={19} /> Báo cáo</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card">
            {user.photoURL
              ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
              : <span>{user.displayName?.charAt(0) || 'A'}</span>}
            <div><strong>{user.displayName || 'Admin'}</strong><small>{user.email}</small></div>
            <button title="Đăng xuất" onClick={() => signOut(auth)}><LogOut size={17} /></button>
          </div>
          <div className="project-pill"><span /> Dữ liệu: cookfit-94659</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">CONTENT LIBRARY</p>
            <h1>Kho công thức</h1>
            <p>Quản lý món ăn, ảnh và nội dung song ngữ hiển thị trong CookFit.</p>
          </div>
          <button className="primary-button" onClick={() => {
            setEditing(emptyRecipeForm())
            setActiveLanguage('vi')
          }}><Plus size={19} /> Thêm món mới</button>
        </header>

        <section className="stat-grid" aria-label="Thống kê nội dung">
          <StatCard label="Tất cả công thức" value={recipes.length} tone="cream" icon={<Utensils size={21} />} />
          <StatCard label="Đang xuất bản" value={publishedCount} tone="green" icon={<Check size={21} />} />
          <StatCard label="Bản nháp" value={draftCount} tone="yellow" icon={<FilePenLine size={21} />} />
          <StatCard label="Món nổi bật" value={recipes.filter((item) => item.featured).length} tone="coral" icon={<Sparkles size={21} />} />
        </section>

        <section className="library-card">
          <div className="library-toolbar">
            <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên món, thiết bị..." /></div>
            <div className="filter-tabs" role="tablist">
              {([['all', 'Tất cả'], ['published', 'Đã xuất bản'], ['draft', 'Bản nháp']] as const).map(([value, label]) => (
                <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="library-filters" aria-label="Lọc công thức">
            <div className="library-filter-controls">
              <label className="library-filter">
                <span>Nhóm nội dung</span>
                <select value={boxFilter} onChange={(event) => setBoxFilter(event.target.value)}>
                  <option value="all">Tất cả nhóm</option>
                  <option value="unassigned">Không gán box</option>
                  {boxFilterOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="library-filter">
                <span>Món nổi bật</span>
                <select value={featuredFilter} onChange={(event) => setFeaturedFilter(event.target.value as 'all' | 'featured' | 'regular')}>
                  <option value="all">Tất cả món</option>
                  <option value="featured">Chỉ món nổi bật</option>
                  <option value="regular">Không nổi bật</option>
                </select>
              </label>
            </div>
            <div className="library-filter-summary">
              <span>Hiển thị <strong>{filteredRecipes.length}</strong> / {recipes.length} món</span>
              {hasActiveFilters && <button type="button" onClick={clearFilters}>Xóa bộ lọc</button>}
            </div>
          </div>

          {loading ? <div className="empty-state"><LoaderCircle className="spin" /> Đang tải công thức...</div> : filteredRecipes.length === 0 ? (
            <div className="empty-state"><ChefHat size={38} /><strong>Chưa có món phù hợp</strong><span>Thử đổi bộ lọc hoặc tạo công thức mới.</span></div>
          ) : (
            <div className="recipe-table-wrap">
              <table className="recipe-table">
                <thead><tr><th>Món ăn</th><th>Thiết bị</th><th>Thời gian</th><th>Trạng thái</th><th>Ưu tiên</th><th /></tr></thead>
                <tbody>{filteredRecipes.map((recipe) => (
                  <tr key={recipe.id} onClick={() => {
                    setEditing(recipeToForm(recipe))
                    setActiveLanguage('vi')
                  }}>
                    <td><div className="recipe-cell"><RecipeThumbnail recipe={recipe} /><div><strong>{recipe.title.vi}</strong><span>{recipe.title.en}</span></div></div></td>
                    <td>{recipe.appliance || '—'}</td>
                    <td><span className="time-cell"><Clock3 size={15} /> {formatCookingTime(recipe.cooking_time)}</span></td>
                    <td><StatusBadge active={recipe.isActive} /></td>
                    <td>{recipe.featured ? <span className="featured-label"><Sparkles size={14} /> Nổi bật</span> : <span className="muted">Thường</span>}</td>
                    <td><button className="icon-button" aria-label={`Sửa ${recipe.title.vi}`}><MoreHorizontal size={19} /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {editing && <EditorPanel
        editing={editing}
        activeLanguage={activeLanguage}
        saving={saving}
        uploading={uploading}
        fileInput={fileInput}
        setActiveLanguage={setActiveLanguage}
        setEditing={setEditing}
        updateForm={updateForm}
        submit={submit}
        uploadImage={uploadImage}
        deleteCurrent={deleteCurrent}
      />}

      {notice && <div className={`toast ${notice.type}`}>{notice.type === 'success' ? <Check size={18} /> : <CircleAlert size={18} />}<span>{notice.message}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}
    </div>
  )
}

type EditorProps = {
  editing: RecipeForm
  activeLanguage: 'vi' | 'en'
  saving: boolean
  uploading: boolean
  fileInput: React.RefObject<HTMLInputElement | null>
  setActiveLanguage: (language: 'vi' | 'en') => void
  setEditing: React.Dispatch<React.SetStateAction<RecipeForm | null>>
  updateForm: <K extends keyof RecipeForm>(key: K, value: RecipeForm[K]) => void
  submit: (publish: boolean) => void
  uploadImage: (file: File) => void
  deleteCurrent: () => void
}

function EditorPanel({ editing, activeLanguage, saving, uploading, fileInput, setActiveLanguage, setEditing, updateForm, submit, uploadImage, deleteCurrent }: EditorProps) {
  const close = () => !saving && !uploading && setEditing(null)
  return <div className="editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className="editor-panel" role="dialog" aria-modal="true" aria-label="Biên tập công thức">
      <header className="editor-header">
        <button className="back-button" onClick={close} disabled={saving || uploading}><ChevronLeft size={20} /></button>
        <div><p>{editing.id ? 'CHỈNH SỬA CÔNG THỨC' : 'CÔNG THỨC MỚI'}</p><h2>{editing.titleVi || editing.titleEn || 'Món chưa đặt tên'}</h2></div>
        <button className="close-button" onClick={close} disabled={saving || uploading}><X size={20} /></button>
      </header>

      <div className="editor-body">
        <div className="editor-column editor-fields">
          <div className="language-tabs">
            <button className={activeLanguage === 'vi' ? 'active' : ''} onClick={() => setActiveLanguage('vi')}>Tiếng Việt</button>
            <button className={activeLanguage === 'en' ? 'active' : ''} onClick={() => setActiveLanguage('en')}>English</button>
            <span>Cần đủ 2 ngôn ngữ trước khi xuất bản</span>
          </div>

          <LocalizedFields language={activeLanguage} form={editing} update={updateForm} />
          <div className="form-section-title"><span>02</span><div><strong>Phân loại & hiển thị</strong><small>Dùng để tìm kiếm và sắp xếp trong app</small></div></div>
          <div className="form-grid three">
            <Field label="Loại món"><select value={editing.category} onChange={(e) => updateForm('category', e.target.value)}>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Thiết bị nấu"><input value={editing.appliance} onChange={(e) => updateForm('appliance', e.target.value)} placeholder="Nồi chiên không dầu" /></Field>
            <Field label="Thời gian (phút)"><input inputMode="numeric" value={editing.cookingTime} onChange={(e) => updateForm('cookingTime', e.target.value)} placeholder="30" /></Field>
            <Field label="Độ khó"><select value={editing.difficulty} onChange={(e) => updateForm('difficulty', e.target.value)}><option value="easy">Dễ</option><option value="medium">Vừa</option><option value="hard">Khó</option></select></Field>
            <Field label="Thứ tự ưu tiên"><input inputMode="numeric" value={editing.order} onChange={(e) => updateForm('order', e.target.value)} placeholder="1" /></Field>
            <Field label="Nhóm nội dung"><select value={editing.boxKey} onChange={(e) => updateForm('boxKey', e.target.value)}><option value="">Không gán box</option>{boxOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{editing.boxKey && !boxOptions.some(([value]) => value === editing.boxKey) && <option value={editing.boxKey}>{editing.boxKey}</option>}</select></Field>
          </div>
          <label className="check-card"><input type="checkbox" checked={editing.featured} onChange={(e) => updateForm('featured', e.target.checked)} /><span><Sparkles size={18} /><strong>Đánh dấu món nổi bật</strong><small>Món sẽ được ưu tiên ở đầu danh sách và trên Home.</small></span></label>
          <details className="advanced-fields">
            <summary>Nguyên liệu dùng để ghép tìm kiếm</summary>
            <div className="form-grid three">
              <Field label="Nguyên liệu chính"><textarea rows={5} value={editing.mainIngredients} onChange={(e) => updateForm('mainIngredients', e.target.value)} placeholder={'chicken\nrice'} /></Field>
              <Field label="Bắt buộc"><textarea rows={5} value={editing.requiredIngredients} onChange={(e) => updateForm('requiredIngredients', e.target.value)} placeholder={'chicken\nrice'} /></Field>
              <Field label="Không bắt buộc"><textarea rows={5} value={editing.optionalIngredients} onChange={(e) => updateForm('optionalIngredients', e.target.value)} placeholder={'onion\npepper'} /></Field>
            </div>
          </details>
        </div>

        <aside className="editor-column media-column">
          <div className="form-section-title"><span>03</span><div><strong>Ảnh món ăn</strong><small>Ảnh thật dùng trên card và trang chi tiết</small></div></div>
          <div className={`image-uploader ${editing.imageUrl ? 'has-image' : ''}`}>
            {editing.imageUrl ? <img src={editing.imageUrl} alt={`Xem trước ${editing.titleVi}`} /> : <div className="upload-placeholder"><ImagePlus size={34} /><strong>Chưa có ảnh món</strong><span>JPG, PNG hoặc WebP</span></div>}
            {uploading && <div className="uploading-overlay"><LoaderCircle className="spin" /><span>Đang tối ưu và tải ảnh...</span></div>}
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </div>
          <button className="secondary-button full" onClick={() => fileInput.current?.click()} disabled={uploading}><Upload size={18} /> {editing.imageUrl ? 'Thay ảnh khác' : 'Chọn ảnh từ máy'}</button>
          <div className="image-hint"><Check size={15} /><span>Tự cắt giữa theo tỷ lệ 16:9, xuất WebP 1600 × 900.</span></div>
          <div className="preview-card">
            <div className="preview-label">XEM TRƯỚC TRONG APP</div>
            <div className="phone-card">
              <div className="phone-image">{editing.imageUrl ? <img src={editing.imageUrl} alt="" /> : <ChefHat size={45} />}{editing.featured && <span><Sparkles size={12} /> Nổi bật</span>}</div>
              <div className="phone-copy"><strong>{editing.titleVi || 'Tên món ăn'}</strong><p>{editing.descriptionVi || 'Mô tả ngắn của món ăn sẽ hiển thị tại đây.'}</p><div><span><Clock3 size={13} /> {formatCookingTime(editing.cookingTime)}</span><span>{editing.appliance || 'Thiết bị'}</span></div></div>
            </div>
          </div>
          <details className="advanced-fields source-fields">
            <summary>Nguồn và ảnh dự phòng</summary>
            <Field label="Image key cũ"><input value={editing.imageKey} onChange={(e) => updateForm('imageKey', e.target.value)} placeholder="chicken_roasted" /></Field>
            <Field label="Tên nguồn"><input value={editing.sourceName} onChange={(e) => updateForm('sourceName', e.target.value)} placeholder="CookFit Studio" /></Field>
            <Field label="URL nguồn"><input value={editing.sourceUrl} onChange={(e) => updateForm('sourceUrl', e.target.value)} placeholder="https://..." /></Field>
          </details>
        </aside>
      </div>

      <footer className="editor-footer">
        <div>{editing.id && <button className="danger-button" onClick={deleteCurrent} disabled={saving || uploading}><Trash2 size={17} /> Xóa món</button>}</div>
        <div className="footer-actions">
          <button className="secondary-button" onClick={() => submit(false)} disabled={saving || uploading}>{saving ? <LoaderCircle className="spin" size={17} /> : <FilePenLine size={17} />} Lưu bản nháp</button>
          <button className="primary-button" onClick={() => submit(true)} disabled={saving || uploading}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Xuất bản</button>
        </div>
      </footer>
    </section>
  </div>
}

function LocalizedFields({ language, form, update }: { language: 'vi' | 'en'; form: RecipeForm; update: <K extends keyof RecipeForm>(key: K, value: RecipeForm[K]) => void }) {
  const isVi = language === 'vi'
  return <>
    <div className="form-section-title"><span>01</span><div><strong>Nội dung {isVi ? 'tiếng Việt' : 'English'}</strong><small>Mỗi dòng nguyên liệu hoặc bước nấu là một mục</small></div></div>
    <Field label={isVi ? 'Tên món' : 'Recipe name'} required><input value={isVi ? form.titleVi : form.titleEn} onChange={(e) => update(isVi ? 'titleVi' : 'titleEn', e.target.value)} placeholder={isVi ? 'Ví dụ: Gà nướng mật ong' : 'Example: Honey glazed chicken'} /></Field>
    <Field label={isVi ? 'Mô tả ngắn' : 'Short description'} required><textarea rows={3} value={isVi ? form.descriptionVi : form.descriptionEn} onChange={(e) => update(isVi ? 'descriptionVi' : 'descriptionEn', e.target.value)} placeholder={isVi ? 'Mô tả hương vị và điểm nổi bật...' : 'Describe the flavor and highlights...'} /></Field>
    <div className="form-grid two">
      <Field label={isVi ? 'Nguyên liệu' : 'Ingredients'} hint={isVi ? 'Mỗi nguyên liệu một dòng' : 'One ingredient per line'} required><textarea rows={9} value={isVi ? form.ingredientsVi : form.ingredientsEn} onChange={(e) => update(isVi ? 'ingredientsVi' : 'ingredientsEn', e.target.value)} placeholder={isVi ? '500g ức gà\n2 thìa mật ong\n1 thìa nước tương' : '500g chicken breast\n2 tbsp honey\n1 tbsp soy sauce'} /></Field>
      <Field label={isVi ? 'Các bước nấu' : 'Cooking steps'} hint={isVi ? 'Mỗi bước một dòng' : 'One step per line'} required><textarea rows={9} value={isVi ? form.stepsVi : form.stepsEn} onChange={(e) => update(isVi ? 'stepsVi' : 'stepsEn', e.target.value)} placeholder={isVi ? 'Ướp gà trong 20 phút\nLàm nóng nồi chiên\nNướng đến khi vàng' : 'Marinate for 20 minutes\nPreheat the air fryer\nCook until golden'} /></Field>
    </div>
  </>
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="field"><span>{label}{required && <em>*</em>}{hint && <small>{hint}</small>}</span>{children}</label>
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return <div className={`stat-card ${tone}`}><span className="stat-icon">{icon}</span><div><strong>{value}</strong><span>{label}</span></div></div>
}

function RecipeThumbnail({ recipe }: { recipe: RecipeDocument }) {
  return <div className="recipe-thumb">{recipe.imageUrl ? <img src={recipe.imageUrl} alt="" /> : <ChefHat size={23} />}</div>
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`status-badge ${active ? 'published' : 'draft'}`}><i />{active ? 'Đã xuất bản' : 'Bản nháp'}</span>
}

function LoginScreen({ onLogin, error }: { onLogin: () => void; error: string }) {
  return <main className="login-page">
    <section className="login-visual"><div className="visual-glow" /><div className="hero-mark"><ChefHat size={64} /></div><h1>Nội dung tốt,<br />bữa ăn ngon.</h1><p>Quản lý kho công thức CookFit song ngữ, đồng bộ trực tiếp đến ứng dụng.</p></section>
    <section className="login-panel"><div className="login-box"><div className="brand login-brand"><div className="brand-mark"><ChefHat size={24} /></div><div><strong>CookFit</strong><span>Content Studio</span></div></div><p className="eyebrow">WELCOME BACK</p><h2>Đăng nhập quản trị</h2><p className="login-description">Dùng tài khoản Google quản trị CookFit.</p><button className="google-button" onClick={onLogin}><span>G</span> Tiếp tục với Google</button>{error && <div className="login-error"><CircleAlert size={18} /><span>{error}</span></div>}<small className="login-note">Phiên bản đầu chỉ mở cho tài khoản sở hữu Firebase hiện tại.</small></div></section>
  </main>
}

function FullPageLoader() {
  return <div className="full-loader"><LoaderCircle className="spin" /><span>Đang mở CookFit Content Studio...</span></div>
}

function formatCookingTime(value: number | string) {
  const text = String(value ?? '').trim()
  if (!text) return '—'
  return /min|phút/i.test(text) ? text : `${text} phút`
}

function friendlyFirebaseError(error: Error) {
  const message = error.message || 'Đã có lỗi xảy ra.'
  if (message.includes('auth/operation-not-allowed')) return 'Google Sign-In chưa được bật trong Firebase Authentication.'
  if (message.includes('auth/unauthorized-domain')) return 'Tên miền CookFit Admin chưa được thêm vào Authorized domains.'
  if (message.includes('permission-denied') || message.includes('Missing or insufficient permissions')) return 'Firebase Rules chưa cho phép tài khoản quản trị đọc hoặc ghi dữ liệu.'
  if (message.includes('storage/unauthorized')) return 'Storage Rules chưa cho phép tải ảnh lên.'
  return message.replace(/^Firebase:\s*/i, '')
}

export default App
