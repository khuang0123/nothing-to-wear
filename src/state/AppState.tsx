import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppData,
  Friend,
  Garment,
  Outfit,
  StylingPreferences,
  UserProfile,
  WardrobeReport,
} from '../types'
import { clearData, emptyData, loadData, newId, saveData } from '../lib/storage'
import { analyseWardrobe, predictWardrobe, type Prediction } from '../lib/wardrobe'
import { demoGarments, demoProfile } from '../lib/demoCloset'

interface AppApi {
  data: AppData
  report: WardrobeReport | null
  predictions: Prediction[]
  saveProfile: (profile: Omit<UserProfile, 'id' | 'createdAt'>) => void
  updateProfile: (patch: Partial<UserProfile>) => void
  addGarment: (garment: Omit<Garment, 'id' | 'createdAt'>) => Garment
  updateGarment: (id: string, patch: Partial<Garment>) => void
  removeGarment: (id: string) => void
  confirmPrediction: (garment: Garment) => void
  dismissPrediction: (id: string) => void
  setPreferences: (patch: Partial<StylingPreferences>) => void
  saveOutfit: (outfit: Outfit) => void
  removeOutfit: (id: string) => void
  addFriend: (name: string, phone: string) => void
  removeFriend: (id: string) => void
  markFirstSessionDone: () => void
  loadSampleCloset: () => void
  resetEverything: () => void
}

const AppContext = createContext<AppApi | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData())

  useEffect(() => {
    saveData(data)
  }, [data])

  const report = useMemo(
    () => (data.profile ? analyseWardrobe(data.garments, data.profile) : null),
    [data.garments, data.profile],
  )

  const predictions = useMemo(() => {
    if (!data.profile || data.garments.length === 0) return []
    const skip = new Set([...data.garments.map((g) => g.id), ...data.dismissedPredictions])
    return predictWardrobe(data.garments, data.profile).filter((p) => !skip.has(p.garment.id))
  }, [data.garments, data.profile, data.dismissedPredictions])

  const saveProfile = useCallback((profile: Omit<UserProfile, 'id' | 'createdAt'>) => {
    setData((prev) => ({
      ...prev,
      profile: {
        ...profile,
        id: prev.profile?.id ?? newId('user'),
        createdAt: prev.profile?.createdAt ?? Date.now(),
      },
    }))
  }, [])

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setData((prev) => (prev.profile ? { ...prev, profile: { ...prev.profile, ...patch } } : prev))
  }, [])

  const addGarment = useCallback((garment: Omit<Garment, 'id' | 'createdAt'>) => {
    const created: Garment = { ...garment, id: newId('item'), createdAt: Date.now() }
    setData((prev) => ({ ...prev, garments: [created, ...prev.garments] }))
    return created
  }, [])

  const updateGarment = useCallback((id: string, patch: Partial<Garment>) => {
    setData((prev) => ({
      ...prev,
      garments: prev.garments.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }))
  }, [])

  const removeGarment = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      garments: prev.garments.filter((g) => g.id !== id),
      // An outfit missing a piece is not an outfit.
      outfits: prev.outfits.filter((o) => !o.itemIds.includes(id)),
    }))
  }, [])

  const confirmPrediction = useCallback((garment: Garment) => {
    setData((prev) =>
      prev.garments.some((g) => g.id === garment.id)
        ? { ...prev, garments: prev.garments.map((g) => (g.id === garment.id ? { ...g, confirmed: true } : g)) }
        : { ...prev, garments: [{ ...garment, confirmed: true }, ...prev.garments] },
    )
  }, [])

  const dismissPrediction = useCallback((id: string) => {
    setData((prev) =>
      prev.dismissedPredictions.includes(id)
        ? prev
        : { ...prev, dismissedPredictions: [...prev.dismissedPredictions, id] },
    )
  }, [])

  const setPreferences = useCallback((patch: Partial<StylingPreferences>) => {
    setData((prev) => ({ ...prev, preferences: { ...prev.preferences, ...patch } }))
  }, [])

  const saveOutfit = useCallback((outfit: Outfit) => {
    setData((prev) => ({
      ...prev,
      outfits: [
        { ...outfit, saved: true },
        ...prev.outfits.filter((o) => o.id !== outfit.id),
      ],
      hasCompletedFirstSession: true,
    }))
  }, [])

  const removeOutfit = useCallback((id: string) => {
    setData((prev) => ({ ...prev, outfits: prev.outfits.filter((o) => o.id !== id) }))
  }, [])

  const addFriend = useCallback((name: string, phone: string) => {
    const friend: Friend = { id: newId('friend'), name, phone, addedAt: Date.now() }
    setData((prev) =>
      prev.friends.some((f) => f.phone === phone) ? prev : { ...prev, friends: [friend, ...prev.friends] },
    )
  }, [])

  const removeFriend = useCallback((id: string) => {
    setData((prev) => ({ ...prev, friends: prev.friends.filter((f) => f.id !== id) }))
  }, [])

  const markFirstSessionDone = useCallback(() => {
    setData((prev) => (prev.hasCompletedFirstSession ? prev : { ...prev, hasCompletedFirstSession: true }))
  }, [])

  /** Fills the app with a sample profile and closet so it can be explored immediately. */
  const loadSampleCloset = useCallback(() => {
    setData((prev) => ({
      ...prev,
      profile: {
        ...demoProfile(),
        id: prev.profile?.id ?? newId('user'),
        createdAt: prev.profile?.createdAt ?? Date.now(),
      },
      garments: demoGarments(),
      outfits: [],
      dismissedPredictions: [],
      hasCompletedFirstSession: false,
    }))
  }, [])

  const resetEverything = useCallback(() => {
    clearData()
    setData(emptyData())
  }, [])

  const api = useMemo<AppApi>(
    () => ({
      data,
      report,
      predictions,
      saveProfile,
      updateProfile,
      addGarment,
      updateGarment,
      removeGarment,
      confirmPrediction,
      dismissPrediction,
      setPreferences,
      saveOutfit,
      removeOutfit,
      addFriend,
      removeFriend,
      markFirstSessionDone,
      loadSampleCloset,
      resetEverything,
    }),
    [
      data,
      report,
      predictions,
      saveProfile,
      updateProfile,
      addGarment,
      updateGarment,
      removeGarment,
      confirmPrediction,
      dismissPrediction,
      setPreferences,
      saveOutfit,
      removeOutfit,
      addFriend,
      removeFriend,
      markFirstSessionDone,
      loadSampleCloset,
      resetEverything,
    ],
  )

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
