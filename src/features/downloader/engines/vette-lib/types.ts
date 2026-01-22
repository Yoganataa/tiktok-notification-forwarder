export interface ImageData {
  id: string
  url: string
  thumbnail: string
  selected?: boolean
}

export interface VideoData {
  id: string
  title: string
  url: string
  thumbnail: string
  duration: number
  author: string
  description: string
  downloadUrl: string
  images?: ImageData[]
  isPhotoCarousel?: boolean
}
