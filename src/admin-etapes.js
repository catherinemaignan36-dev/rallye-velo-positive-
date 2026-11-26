
export function initialiserGestionEtapes({ supabase, stages, photosEtapes }) {
  const tableau = document.querySelector('#admin-tableau')

  if (!tableau) {
    console.error('Espace administration introuvable.')
    return {}
  }

  if (document.querySelector('#gestion-etapes-rvp')) return {}

  const zone = document.createElement('section')
  zone.id = 'gestion-etapes-rvp'
  zone.style.cssText = `
    margin-top:30px;
    padding:20px;
    background:#f5f7f5;
    border-radius:12px;
    color:#174D36;
  `

  zone.innerHTML = `
    <h2>Gestion des étapes</h2>
    <p id="nom-rallye-selectionne">Sélectionne un rallye.</p>
    <button type="button" id="ouvrir-editeur-etapes"
      style="background:#174D36;color:white;border:0;padding:12px 18px;border-radius:8px;cursor:pointer;">
      Modifier les étapes
    </button>
    <div id="editeur-etapes-contenu" style="display:none;margin-top:20px;">
      <label for="choix-etape"><strong>Choisir une étape</strong></label>
      <select id="choix-etape" style="display:block;width:100%;padding:10px;margin:8px 0 18px;"></select>
      <div id="formulaire-etape"><p>Sélectionne une étape.</p></div>
    </div>
    <p id="message-etapes" role="status" style="margin-top:12px;"></p>
  `

  tableau.appendChild(zone)

  const bouton = zone.querySelector('#ouvrir-editeur-etapes')
  const contenu = zone.querySelector('#editeur-etapes-contenu')
  const select = zone.querySelector('#choix-etape')
  const formulaire = zone.querySelector('#formulaire-etape')
  const message = zone.querySelector('#message-etapes')
  const nomRallye = zone.querySelector('#nom-rallye-selectionne')

  let rallyeIdActuel = null
  let rallyeNomActuel = ''
  let listeEtapes = []
  let listeSolutions = []

  function securiser(texte) {
    return String(texte ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  async function selectionnerRallye(id, nom) {
    rallyeIdActuel = id
    rallyeNomActuel = nom || 'Rallye sélectionné'
    nomRallye.textContent = `Rallye sélectionné : ${rallyeNomActuel}`
    contenu.style.display = 'block'
    bouton.textContent = 'Masquer les étapes'
    await chargerEtapes()
    zone.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  bouton.addEventListener('click', async () => {
    if (!rallyeIdActuel) {
      message.textContent = 'Sélectionne d’abord un rallye dans la liste.'
      return
    }

    const ouvert = contenu.style.display !== 'none'
    contenu.style.display = ouvert ? 'none' : 'block'
    bouton.textContent = ouvert ? 'Modifier les étapes' : 'Masquer les étapes'

    if (!ouvert) await chargerEtapes()
  })

  select.addEventListener('change', afficherEtape)

  async function chargerEtapes() {
    if (!rallyeIdActuel) return

    message.textContent = 'Chargement des étapes...'
    formulaire.innerHTML = '<p>Chargement...</p>'

    const { data: etapes, error } = await supabase
      .from('stages')
      .select('*')
      .eq('rallye_id', rallyeIdActuel)
      .order('numero', { ascending: true })

    if (error) {
      message.textContent = 'Impossible de charger les étapes : ' + error.message
      return
    }

    listeEtapes = etapes || []
    listeSolutions = []

    if (listeEtapes.length) {
      const ids = listeEtapes.map(etape => etape.id)

      const { data: solutions, error: erreurSolutions } = await supabase
        .from('solutions_etapes')
        .select('*')
        .in('etape_id', ids)

      if (erreurSolutions) {
        message.textContent = 'Impossible de charger les réponses : ' + erreurSolutions.message
        return
      }

      listeSolutions = solutions || []
    }

    select.innerHTML = `
      <option value="__nouvelle__">+ Créer une nouvelle étape</option>
      ${listeEtapes.map(etape => `
        <option value="${etape.id}">
          Étape ${etape.numero} — ${securiser(etape.nom)}
        </option>
      `).join('')}
    `

    select.value = listeEtapes.length
      ? String(listeEtapes[0].id)
      : '__nouvelle__'

    afficherEtape()

    message.textContent = listeEtapes.length
      ? `${listeEtapes.length} étape(s) chargée(s) pour ce rallye.`
      : 'Ce rallye ne contient aucune étape. Tu peux créer la première.'
  }

  function afficherEtape() {
    if (select.value === '__nouvelle__') {
      afficherFormulaireNouvelleEtape()
      return
    }

    const etape = listeEtapes.find(item => String(item.id) === select.value)

    if (!etape) {
      formulaire.innerHTML = '<p>Étape introuvable.</p>'
      return
    }

    const solution = listeSolutions.find(
      item => Number(item.etape_id) === Number(etape.id)
    )

    const reponses = solution?.reponses_acceptees || []

    formulaire.innerHTML = `
      <form id="form-edition-etape">
        <label><strong>Nom du lieu</strong></label>
        <input name="nom" value="${securiser(etape.nom)}" required style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Titre de l'étape</strong></label>
        <input name="titre" value="${securiser(etape.titre)}" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Introduction / présentation</strong></label>
        <textarea name="introduction" rows="4" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">${securiser(etape.introduction)}</textarea>

        <label><strong>Énigme / question</strong></label>
        <textarea name="enigme" rows="4" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">${securiser(etape.enigme)}</textarea>

        <label><strong>Indice</strong></label>
        <textarea name="indice" rows="2" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">${securiser(etape.indice)}</textarea>

        <label><strong>Réponse attendue</strong></label>
        <input name="reponse_attendue" value="${securiser(solution?.reponse_attendue)}" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Autres réponses acceptées</strong></label>
        <textarea name="reponses_acceptees" rows="3" placeholder="Une réponse par ligne" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">${securiser(reponses.join('\n'))}</textarea>

        <label><strong>Photo de fond (adresse URL)</strong></label>
        <input name="photo_url" value="${securiser(etape.photo_url)}" placeholder="https://..." style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Latitude</strong></label>
        <input name="latitude" type="number" step="any" value="${securiser(etape.latitude)}" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Longitude</strong></label>
        <input name="longitude" type="number" step="any" value="${securiser(etape.longitude)}" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label style="display:flex;align-items:center;gap:8px;margin:12px 0;">
          <input name="active" type="checkbox" ${etape.active ? 'checked' : ''}>
          Étape active
        </label>

        <button type="submit" style="background:#174D36;color:white;border:0;padding:12px 20px;border-radius:8px;cursor:pointer;">
          Enregistrer cette étape
        </button>
      </form>
    `

    formulaire.querySelector('#form-edition-etape')
      .addEventListener('submit', enregistrerEtape)
  }

  function afficherFormulaireNouvelleEtape() {
    const numero = listeEtapes.reduce(
      (max, etape) => Math.max(max, Number(etape.numero) || 0), 0
    ) + 1

    formulaire.innerHTML = `
      <h3>Créer l'étape ${numero}</h3>
      <form id="form-nouvelle-etape">
        <label><strong>Nom du lieu</strong></label>
        <input name="nom" required placeholder="Ex. Place du village" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Titre de l'étape</strong></label>
        <input name="titre" placeholder="Ex. Bienvenue sur cette étape" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Introduction / présentation</strong></label>
        <textarea name="introduction" rows="3" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;"></textarea>

        <label><strong>Énigme / question</strong></label>
        <textarea name="enigme" rows="4" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;"></textarea>

        <label><strong>Indice</strong></label>
        <textarea name="indice" rows="2" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;"></textarea>

        <label><strong>Réponse attendue</strong></label>
        <input name="reponse_attendue" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Autres réponses acceptées</strong></label>
        <textarea name="reponses_acceptees" rows="3" placeholder="Une réponse par ligne" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;"></textarea>

        <label><strong>Type d'étape</strong></label>
        <select name="type_etape" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">
          <option value="enigme">Énigme</option>
          <option value="photo">Photo</option>
        </select>

        <label><strong>Photo de fond (adresse URL)</strong></label>
        <input name="photo_url" placeholder="https://..." style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Latitude</strong></label>
        <input name="latitude" type="number" step="any" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label><strong>Longitude</strong></label>
        <input name="longitude" type="number" step="any" style="display:block;width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box;">

        <label style="display:flex;align-items:center;gap:8px;margin:12px 0;">
          <input name="active" type="checkbox" checked>
          Étape active
        </label>

        <button type="submit" style="background:#174D36;color:white;border:0;padding:12px 20px;border-radius:8px;cursor:pointer;">
          Créer cette étape
        </button>
      </form>
    `

    formulaire.querySelector('#form-nouvelle-etape')
      .addEventListener('submit', creerEtape)
  }

  function lireDonneesFormulaire(form) {
    const donnees = new FormData(form)
    const texte = nom => String(donnees.get(nom) ?? '').trim()
    const nombre = nom => texte(nom) === '' ? null : Number(texte(nom))
    return { donnees, texte, nombre }
  }

  async function creerEtape(event) {
    event.preventDefault()

    const form = event.currentTarget
    const { texte, nombre } = lireDonneesFormulaire(form)

    const numero = listeEtapes.reduce(
      (max, etape) => Math.max(max, Number(etape.numero) || 0), 0
    ) + 1

    const nouvelleEtape = {
      rallye_id: rallyeIdActuel,
      numero,
      nom: texte('nom'),
      titre: texte('titre') || texte('nom'),
      introduction: texte('introduction'),
      enigme: texte('enigme'),
      indice: texte('indice'),
      photo_url: texte('photo_url') || null,
      latitude: nombre('latitude'),
      longitude: nombre('longitude'),
      active: form.elements.active.checked,
      type_etape: texte('type_etape') || 'enigme'
    }

    if (!nouvelleEtape.nom) {
      message.textContent = 'Indique le nom du lieu.'
      return
    }

    const boutonEnregistrer = form.querySelector('button[type="submit"]')
    boutonEnregistrer.disabled = true
    boutonEnregistrer.textContent = 'Création en cours...'
    message.textContent = 'Création de l’étape...'

    const { data: etapeCreee, error } = await supabase
      .from('stages')
      .insert(nouvelleEtape)
      .select()
      .single()

    if (error) {
      message.textContent = 'Erreur lors de la création : ' + error.message
      boutonEnregistrer.disabled = false
      boutonEnregistrer.textContent = 'Créer cette étape'
      return
    }

    const reponseAttendue = texte('reponse_attendue')
    const reponsesAcceptees = texte('reponses_acceptees')
      .split('\n').map(r => r.trim()).filter(Boolean)

    if (reponseAttendue || reponsesAcceptees.length) {
      const { error: erreurSolution } = await supabase
        .from('solutions_etapes')
        .insert({
          etape_id: etapeCreee.id,
          reponse_attendue: reponseAttendue,
          reponses_acceptees: reponsesAcceptees
        })

      if (erreurSolution) {
        message.textContent = 'Étape créée, mais erreur sur la réponse : ' + erreurSolution.message
        await chargerEtapes()
        select.value = String(etapeCreee.id)
        afficherEtape()
        return
      }
    }

    await chargerEtapes()
    select.value = String(etapeCreee.id)
    afficherEtape()
    message.textContent = `L’étape ${numero} a bien été créée.`
  }

  async function enregistrerEtape(event) {
    event.preventDefault()

    const etape = listeEtapes.find(item => String(item.id) === select.value)
    if (!etape) return

    const form = event.currentTarget
    const { donnees, texte, nombre } = lireDonneesFormulaire(form)

    const modifications = {
      nom: texte('nom'),
      titre: texte('titre'),
      introduction: texte('introduction'),
      enigme: texte('enigme'),
      indice: texte('indice'),
      photo_url: texte('photo_url') || null,
      latitude: nombre('latitude'),
      longitude: nombre('longitude'),
      active: donnees.has('active')
    }

    message.textContent = 'Enregistrement de l’étape...'

    const { error } = await supabase
      .from('stages')
      .update(modifications)
      .eq('id', etape.id)
      .eq('rallye_id', rallyeIdActuel)

    if (error) {
      message.textContent = 'Erreur : ' + error.message
      return
    }

    const reponseAttendue = texte('reponse_attendue')
    const reponsesAcceptees = texte('reponses_acceptees')
      .split('\n').map(r => r.trim()).filter(Boolean)

    const solutionExistante = listeSolutions.find(
      item => Number(item.etape_id) === Number(etape.id)
    )

    const donneesSolution = {
      etape_id: etape.id,
      reponse_attendue: reponseAttendue,
      reponses_acceptees: reponsesAcceptees
    }

    let erreurSolution = null

    if (solutionExistante) {
      const resultat = await supabase
        .from('solutions_etapes')
        .update(donneesSolution)
        .eq('id', solutionExistante.id)
      erreurSolution = resultat.error
    } else if (reponseAttendue || reponsesAcceptees.length) {
      const resultat = await supabase
        .from('solutions_etapes')
        .insert(donneesSolution)
      erreurSolution = resultat.error
    }

    if (erreurSolution) {
      message.textContent = 'Étape enregistrée, mais erreur sur les réponses : ' + erreurSolution.message
      return
    }

    Object.assign(etape, modifications)

    if (Array.isArray(stages) && rallyeNomActuel.includes('Île de Ré')) {
      const etapeLocale = stages.find(
        item => Number(item.number) === Number(etape.numero)
      )

      if (etapeLocale) {
        etapeLocale.name = modifications.nom
        etapeLocale.title = modifications.titre
        etapeLocale.intro = modifications.introduction
        etapeLocale.riddle = modifications.enigme
        etapeLocale.lat = modifications.latitude
        etapeLocale.lon = modifications.longitude
      }
    }

    if (photosEtapes && rallyeNomActuel.includes('Île de Ré')) {
      if (modifications.photo_url) {
        photosEtapes[etape.numero] = modifications.photo_url
      }
    }

    if (solutionExistante) {
      Object.assign(solutionExistante, donneesSolution)
    } else if (reponseAttendue || reponsesAcceptees.length) {
      listeSolutions.push(donneesSolution)
    }

    message.textContent = `Étape ${etape.numero} enregistrée avec succès.`

    const option = select.options[select.selectedIndex]
    if (option) {
      option.textContent = `Étape ${etape.numero} — ${etape.nom}`
    }
  }

  return { selectionnerRallye }
}


