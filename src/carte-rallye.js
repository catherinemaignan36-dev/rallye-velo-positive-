
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(workerUrl)

let carte = null
let marqueurPosition = null
let coordonneesItineraire = []
let indications = []
let prochaineIndication = 0
let dernierePosition = null
let derniereDirection = 0
let premiereErreurAffichee = false
let calculEnCours = false

const lieuxRallye = [
  { numero: 1, nom: "Office de tourisme Saint-Martin", lat: 46.205735, lng: -1.365491 },
  { numero: 2, nom: "Citadelle Vauban", lat: 46.204928, lng: -1.358847 },
  { numero: 3, nom: "Porte de Toiras", lat: 46.200413, lng: -1.361900 },
  { numero: 4, nom: "Gendarmerie", lat: 46.193706, lng: -1.356675 },
  { numero: 5, nom: "Moulin de Bellère", lat: 46.193460, lng: -1.370209 },
  { numero: 6, nom: "Église du Bois-Plage", lat: 46.185275, lng: -1.392716 },
  { numero: 7, nom: "Église de La Couarde", lat: 46.194149, lng: -1.424486 },
  { numero: 8, nom: "Marais salants de Loix", lat: 46.208995, lng: -1.450798 },
  { numero: 9, nom: "Pick-Sel", lat: 46.211036, lng: -1.439911 },
  { numero: 10, nom: "Moulin à marée de Loix", lat: 46.215955, lng: -1.439300 },
  { numero: 11, nom: "Bassin du Goisil", lat: 46.193310, lng: -1.437285 },
  { numero: 12, nom: "Réostréa", lat: 46.204644, lng: -1.381815 },
  { numero: 13, nom: "Rue Mérindot – Maison de la Vinaterie", lat: 46.203004, lng: -1.369752 },
  { numero: 14, nom: "Église Saint-Martin", lat: 46.203148, lng: -1.368377 },
  { numero: 15, nom: "Port de Saint-Martin", lat: 46.206432, lng: -1.367857 },
  { numero: 16, nom: "Office de tourisme – arrivée", lat: 46.205735, lng: -1.365491 }
]

function distanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const rad = valeur => valeur * Math.PI / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) *
    Math.cos(rad(lat2)) *
    Math.sin(dLon / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calculerCap(lat1, lon1, lat2, lon2) {
  const rad = valeur => valeur * Math.PI / 180
  const deg = valeur => valeur * 180 / Math.PI

  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2))
  const x =
    Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) *
    Math.cos(rad(lon2 - lon1))

  return (deg(Math.atan2(y, x)) + 360) % 360
}

function texteDirection(code, sortie) {
  const directions = {
    1: "Continuez tout droit",
    2: "Tournez à gauche",
    3: "Légèrement à gauche",
    4: "Tournez franchement à gauche",
    5: "Tournez à droite",
    6: "Légèrement à droite",
    7: "Tournez franchement à droite",
    8: "Restez à gauche",
    9: "Restez à droite",
    10: "Faites demi-tour",
    11: "Faites demi-tour à droite",
    12: "Vous semblez hors itinéraire",
    13: "Entrez dans le rond-point",
    14: "Sortez du rond-point",
    15: "Faites demi-tour",
    16: "Continuez sur l'itinéraire"
  }

  let texte = directions[code] || "Continuez sur l'itinéraire"

  if ((code === 13 || code === 14) && sortie > 0) {
    texte += ` (${sortie}e sortie)`
  }

  return texte
}

function afficherNavigation(texte, distance) {
  const panneau = document.getElementById("navigation-rallye")
  if (!panneau) return

  panneau.style.cssText = `
    background:#174D36;
    color:white;
    padding:16px;
    border-radius:14px;
    margin:12px 0;
    text-align:center;
    font-family:inherit;
  `

  panneau.innerHTML = `
    <div style="font-size:12px;opacity:.8;margin-bottom:6px">
      PROCHAINE DIRECTION
    </div>
    <div style="font-size:22px;font-weight:bold">
      ${texte}
    </div>
    <div style="font-size:18px;margin-top:8px">
      ${distance !== null ? `${Math.round(distance)} mètres` : ""}
    </div>
    <div style="font-size:11px;opacity:.75;margin-top:10px">
      Consultez les indications à l'arrêt, en sécurité.
    </div>
  `
}

function creerMarqueurEtape(lieu) {
  const element = document.createElement("div")

  element.style.cssText = `
    width:30px;
    height:30px;
    border-radius:50%;
    background:#174D36;
    color:white;
    border:2px solid white;
    display:flex;
    align-items:center;
    justify-content:center;
    font-weight:bold;
    font-size:13px;
    box-shadow:0 2px 6px rgba(0,0,0,.35);
  `

  element.textContent = lieu.numero

  new maplibregl.Marker({ element })
    .setLngLat([lieu.lng, lieu.lat])
    .setPopup(
      new maplibregl.Popup({ offset: 18 })
        .setHTML(`<strong>Étape ${lieu.numero}</strong><br>${lieu.nom}`)
    )
    .addTo(carte)
}

function creerMarqueurVelo() {
  const element = document.createElement("div")

  element.style.cssText = `
    width:44px;
    height:44px;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:visible;
    filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));
    pointer-events:none;
  `

  element.innerHTML = `
    <svg viewBox="0 0 44 44" width="44" height="44"
      xmlns="http://www.w3.org/2000/svg" aria-label="Vélo vu du dessus">
      <defs>
        <linearGradient id="cadreVeloRVP" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#8FFFE1"/>
          <stop offset="100%" stop-color="#08745F"/>
        </linearGradient>
      </defs>
      <rect x="18" y="1" width="8" height="12" rx="4"
        fill="#101820" stroke="#DCE5E8" stroke-width="1.5"/>
      <rect x="18" y="31" width="8" height="12" rx="4"
        fill="#101820" stroke="#DCE5E8" stroke-width="1.5"/>
      <path d="M13 8 L31 8"
        stroke="#17252B" stroke-width="3.5" stroke-linecap="round"/>
      <g fill="none" stroke="url(#cadreVeloRVP)"
        stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11 L13 23 L22 30 L31 23 Z"/>
        <path d="M13 23 L22 37"/>
        <path d="M31 23 L22 37"/>
      </g>
      <path d="M17 18 L27 18"
        stroke="#17252B" stroke-width="4" stroke-linecap="round"/>
      <circle cx="22" cy="26" r="3"
        fill="#174D36" stroke="#8FFFE1" stroke-width="1.5"/>
    </svg>
  `

  marqueurPosition = new maplibregl.Marker({
    element,
    anchor: "center",
    rotationAlignment: "viewport",
    pitchAlignment: "viewport"
  })
    .setLngLat([-1.365491, 46.205735])
    .addTo(carte)
}

function ajouterCouchesItineraire() {
  if (!carte || !carte.isStyleLoaded()) return

  if (!carte.getSource("itineraire")) {
    carte.addSource("itineraire", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: []
        }
      }
    })

    carte.addLayer({
      id: "ligne-itineraire",
      type: "line",
      source: "itineraire",
      paint: {
        "line-color": "#174D36",
        "line-width": 5,
        "line-opacity": 0.9
      },
      layout: {
        "line-cap": "round",
        "line-join": "round"
      }
    })
  }

  if (!carte.getSource("guidage")) {
    carte.addSource("guidage", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: []
      }
    })

    carte.addLayer({
      id: "guidage-fond",
      type: "line",
      source: "guidage",
      paint: {
        "line-color": "#FFFFFF",
        "line-width": 11,
        "line-opacity": 0.95
      },
      layout: {
        "line-cap": "round",
        "line-join": "round"
      }
    })

    carte.addLayer({
      id: "guidage-bleu",
      type: "line",
      source: "guidage",
      paint: {
        "line-color": "#2878FF",
        "line-width": 7,
        "line-opacity": 1
      },
      layout: {
        "line-cap": "round",
        "line-join": "round"
      }
    })
  }
}

function actualiserLigneGuidage(latitude, longitude) {
  if (!carte || !carte.isStyleLoaded()) return
  if (coordonneesItineraire.length < 2) return

  ajouterCouchesItineraire()

  let indexProche = 0
  let distanceProche = Infinity

  for (let i = 0; i < coordonneesItineraire.length; i++) {
    const point = coordonneesItineraire[i]

    const distance = distanceMetres(
      latitude, longitude, point[1], point[0]
    )

    if (distance < distanceProche) {
      distanceProche = distance
      indexProche = i
    }
  }

  const trajetBleu = [[longitude, latitude]]
  let distanceCumulee = 0
  let precedent = [longitude, latitude]

  for (let i = indexProche; i < coordonneesItineraire.length; i++) {
    const point = coordonneesItineraire[i]

    distanceCumulee += distanceMetres(
      precedent[1], precedent[0], point[1], point[0]
    )

    trajetBleu.push(point)
    precedent = point

    if (distanceCumulee >= 1200) break
  }

  if (trajetBleu.length < 2) return

  carte.getSource("guidage").setData({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: trajetBleu
      }
    }]
  })
}

export function initialiserCarteRallye() {
  const conteneur = document.getElementById("carte-rallye")
  if (!conteneur) return

  if (carte) {
    setTimeout(() => carte?.resize(), 300)
    return
  }

  afficherNavigation("Chargement de la carte…", null)

  try {
    carte = new maplibregl.Map({
      container: conteneur,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [-1.400, 46.205],
      zoom: 12,
      pitch: 65,
      bearing: 0,
      attributionControl: true,
      maxPitch: 80
    })

    carte.on("error", evenement => {
      const erreur =
        evenement.error?.message ||
        evenement.error ||
        "Erreur inconnue"

      console.error("Erreur de carte :", erreur)

      if (!premiereErreurAffichee) {
        premiereErreurAffichee = true
        afficherNavigation("Erreur carte : " + erreur, null)
      }
    })

    carte.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true
      }),
      "top-right"
    )

    carte.on("load", () => {
      ajouterCouchesItineraire()
      lieuxRallye.forEach(creerMarqueurEtape)
      creerMarqueurVelo()
      calculerItineraire()

      if (dernierePosition) {
        actualiserPositionCarte(
          dernierePosition.lat,
          dernierePosition.lng,
          dernierePosition.cap
        )
      }
    })

    setTimeout(() => {
      if (carte) carte.resize()
    }, 500)

  } catch (erreur) {
    console.error("Initialisation de la carte impossible :", erreur)
    afficherNavigation("Impossible d'ouvrir la carte.", null)
  }
}

async function calculerItineraire() {
  if (calculEnCours) return
  calculEnCours = true

  afficherNavigation("Calcul de votre itinéraire…", null)

  const points = lieuxRallye
    .map(lieu => `${lieu.lng},${lieu.lat}`)
    .join("|")

  const url = new URL("https://brouter.de/brouter")
  url.searchParams.set("lonlats", points)
  url.searchParams.set("profile", "trekking")
  url.searchParams.set("alternativeidx", "0")
  url.searchParams.set("format", "geojson")
  url.searchParams.set("timode", "3")

  try {
    const reponse = await fetch(url.toString())

    if (!reponse.ok) {
      throw new Error("Calcul impossible")
    }

    const donnees = await reponse.json()
    const geometrie = donnees.features?.[0]?.geometry

    if (!geometrie?.coordinates?.length) {
      throw new Error("Aucun tracé reçu")
    }

    coordonneesItineraire = geometrie.coordinates

    const afficherTrajet = () => {
      if (!carte || !carte.isStyleLoaded()) return

      ajouterCouchesItineraire()

      carte.getSource("itineraire").setData({
        type: "Feature",
        properties: {},
        geometry: geometrie
      })

      const bornes = new maplibregl.LngLatBounds(
        coordonneesItineraire[0],
        coordonneesItineraire[0]
      )

      coordonneesItineraire.forEach(point => bornes.extend(point))

      carte.fitBounds(bornes, {
        padding: {
          top: 50,
          bottom: 110,
          left: 35,
          right: 35
        },
        pitch: 45,
        duration: 1200
      })

      if (dernierePosition) {
        actualiserLigneGuidage(
          dernierePosition.lat,
          dernierePosition.lng
        )
      }
    }

    if (carte.isStyleLoaded()) {
      afficherTrajet()
    } else {
      carte.once("load", afficherTrajet)
    }

    const voix = donnees.features[0].properties?.voicehints || []

    indications = voix.map(indication => {
      const coordonnee = geometrie.coordinates[indication[0]]
      if (!coordonnee) return null

      return {
        code: indication[1],
        sortie: indication[2],
        lat: coordonnee[1],
        lng: coordonnee[0]
      }
    }).filter(Boolean)

    prochaineIndication = 0

    afficherNavigation("Itinéraire prêt. En attente du GPS…", null)

  } catch (erreur) {
    console.error("Erreur itinéraire :", erreur)
    afficherNavigation(
      "Impossible de calculer le guidage. Vérifiez votre connexion.",
      null
    )
  } finally {
    calculEnCours = false
  }
}

export function actualiserPositionCarte(latitude, longitude, capGPS = null) {
  if (!carte) return

  const positionPrecedente = dernierePosition

  dernierePosition = {
    lat: latitude,
    lng: longitude,
    cap: capGPS
  }

  if (!carte.isStyleLoaded()) {
    carte.once("load", () => {
      actualiserPositionCarte(latitude, longitude, capGPS)
    })
    return
  }

  if (
    Number.isFinite(capGPS) &&
    capGPS >= 0 &&
    capGPS <= 360
  ) {
    derniereDirection = capGPS
  } else if (positionPrecedente) {
    const distance = distanceMetres(
      positionPrecedente.lat,
      positionPrecedente.lng,
      latitude,
      longitude
    )

    if (distance > 3) {
      derniereDirection = calculerCap(
        positionPrecedente.lat,
        positionPrecedente.lng,
        latitude,
        longitude
      )
    }
  }

  if (marqueurPosition) {
    marqueurPosition.setLngLat([longitude, latitude])
  }

  actualiserLigneGuidage(latitude, longitude)

  carte.easeTo({
    center: [longitude, latitude],
    zoom: 18,
    pitch: 65,
    bearing: derniereDirection,
    offset: [0, 90],
    duration: 700
  })

  if (!indications.length) return

  while (prochaineIndication < indications.length - 1) {
    const cible = indications[prochaineIndication]

    const distance = distanceMetres(
      latitude, longitude, cible.lat, cible.lng
    )

    if (distance < 25) {
      prochaineIndication++
    } else {
      break
    }
  }

  const prochaine = indications[prochaineIndication]
  if (!prochaine) return

  const distance = distanceMetres(
    latitude, longitude, prochaine.lat, prochaine.lng
  )

  afficherNavigation(
    texteDirection(prochaine.code, prochaine.sortie),
    distance
  )
}


