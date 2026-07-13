export class AssetLoader {
  static assets = { images: {}, audio: {}, json: {} }
  static promises = []

  static loadImage(key, src) {
    console.log(`Loading image: ${key} from ${src}`)
    const promise = new Promise((resolve, reject) => {
      const img = new Image()
      // Don't set crossOrigin for local files - it causes CORS issues
      img.onload = () => { 
        console.log(`Image loaded: ${key}`)
        this.assets.images[key] = img; resolve(img) 
      }
      img.onerror = (err) => { 
        console.error(`Image load failed: ${key}`, err)
        reject(err) 
      }
      img.src = src
    })
    this.promises.push(promise)
    return promise
  }

  static loadAudio(key, src) {
    const promise = fetch(src)
      .then(r => r.arrayBuffer())
      .then(buf => this.audioContext.decodeAudioData(buf))
      .then(buf => { this.assets.audio[key] = buf })
    this.promises.push(promise)
    return promise
  }

  static loadJSON(key, src) {
    console.log(`Loading JSON: ${key} from ${src}`)
    const promise = fetch(src).then(r => r.json()).then(data => { 
      console.log(`JSON loaded: ${key}`)
      this.assets.json[key] = data 
    })
    this.promises.push(promise)
    return promise
  }

  static async loadAll() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()

    this.loadJSON('theme', '/assets/theme.json')

    await Promise.all(this.promises)
    this.promises = []
    console.log('All assets loaded')
  }

  static getImage(key) { return this.assets.images[key] }
  static getAudio(key) { return this.assets.audio[key] }
  static getJSON(key) { return this.assets.json[key] }
}