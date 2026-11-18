
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// Configuration du Worker obligatoire avec MapLibre 6 et Vite
maplibregl.setWorkerUrl(workerUrl)

let carte = null
let marqueurPosition = null
let traceItineraire = null
let instructionsNavigation = []

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

const STYLE_CARTE = 'https://tiles.openfreemap.org/styles/liberty'
const SOURCE_ITINERAIRE = 'itineraire-rallye'

function creerMarqueurEtape(numero) {
  const element = document.createElement('div')

  element.style.cssText = `
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #174D36;
    color: white;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,.35);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 13px;
  `

  element.textContent = numero
  return element
}

function creerMarqueurVelo() {
  const element = document.createElement('div')

  element.innerHTML = `
    <div style="
      font-size: 32px;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.4));
    ">🚴</div>
  `

  return element
}

function afficherItineraire(donnees) {
  if (!carte || !carte.isStyleLoaded()) return

  if (carte.getLayer('ligne-itineraire')) {
    carte.removeLayer('ligne-itineraire')
  }

  if (carte.getSource(SOURCE_ITINERAIRE)) {
    carte.removeSource(SOURCE_ITINERAIRE)
  }

  carte.addSource(SOURCE_ITINERAIRE, {
    type: 'geojson',
    data: donnees
  })

  carte.addLayer({
    id: 'ligne-itineraire',
    type: 'line',
    source: SOURCE_ITINERAIRE,
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#174D36',
      'line-width': 5,
      'line-opacity': 0.9
    }
  })

  traceItineraire = donnees

  const coordonnees = donnees.features?.[0]?.geometry?.coordinates

  if (coordonnees?.length) {
    const limites = new maplibregl.LngLatBounds()

    coordonnees.forEach(point => limites.extend(point))

    carte.fitBounds(limites, {
      padding: 35,
      maxZoom: 14,
      duration: 1000
    })
  }
}

async function chargerItineraireCyclable() {
  const parametres = new URLSearchParams({
    lonlats: lieuxRallye
      .map(lieu => `${lieu.lng},${lieu.lat}`)
      .join('|'),
    profile: 'fastbike',
    alternativeidx: '0',
    format: 'geojson',
    timode: '3'
  })

  try {
    const reponse = await fetch(
      `https://brouter.de/brouter?${parametres.toString()}`
    )

    if (!reponse.ok) {
      throw new Error('Calcul de l’itinéraire impossible.')
    }

    const donnees = await reponse.json()

    if (!donnees.features?.length) {
      throw new Error('Aucun itinéraire reçu.')
    }

    instructionsNavigation =
      donnees.features[0].properties?.voicehints || []

    afficherItineraire(donnees)

    console.log('Itinéraire vélo chargé.')
    console.log('Instructions :', instructionsNavigation)

  } catch (erreur) {
    console.error('Erreur itinéraire :', erreur)

    const ligneSecours = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: lieuxRallye.map(lieu => [
            lieu.lng,
            lieu.lat
          ])
        }
      }]
    }

    afficherItineraire(ligneSecours)

    console.warn('Affichage provisoire en lignes droites.')
  }
}

export function initialiserCarteRallye() {
  const conteneur = document.getElementById('carte-rallye')

  if (!conteneur) return

  if (carte) {
    carte.resize()
    return
  }

  conteneur.innerHTML = ''

  try {
    carte = new maplibregl.Map({
      container: conteneur,
      style: STYLE_CARTE,
      center: [-1.400, 46.205],
      zoom: 11.5,
      attributionControl: true
    })

    carte.addControl(
      new maplibregl.NavigationControl(),
      'top-right'
    )

    carte.addControl(
      new maplibregl.ScaleControl(),
      'bottom-left'
    )

    carte.on('load', async () => {
      lieuxRallye.forEach(lieu => {
        const popup = new maplibregl.Popup({
          offset: 20
        }).setHTML(
          `<strong>Étape ${lieu.numero}</strong><br>${lieu.nom}`
        )

        new maplibregl.Marker({
          element: creerMarqueurEtape(lieu.numero),
          anchor: 'center'
        })
          .setLngLat([lieu.lng, lieu.lat])
          .setPopup(popup)
          .addTo(carte)
      })

      const limites = new maplibregl.LngLatBounds()

      lieuxRallye.forEach(lieu => {
        limites.extend([lieu.lng, lieu.lat])
      })

      carte.fitBounds(limites, {
        padding: 35,
        maxZoom: 13
      })

      await chargerItineraireCyclable()
    })

    carte.on('error', evenement => {
      console.error('Erreur MapLibre :', evenement.error)
    })

    setTimeout(() => {
      if (carte) carte.resize()
    }, 500)

  } catch (erreur) {
    console.error('Erreur initialisation carte :', erreur)

    conteneur.innerHTML =
      '<p>Impossible de charger la carte. Vérifiez votre connexion.</p>'
  }
}

export function actualiserPositionCarte(latitude, longitude) {
  if (
    !carte ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return
  }

  const position = [longitude, latitude]

  if (!marqueurPosition) {
    marqueurPosition = new maplibregl.Marker({
      element: creerMarqueurVelo(),
      anchor: 'center'
    })
      .setLngLat(position)
      .setPopup(
        new maplibregl.Popup({ offset: 20 })
          .setText('Votre position')
      )
      .addTo(carte)

  } else {
    marqueurPosition.setLngLat(position)
  }
}

