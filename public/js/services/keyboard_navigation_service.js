/* global Turbolinks */
import { toggleMenu, toggleSun, closeMenu } from '../services/theme_service'
import { setCookie } from './cookie_service'
import Mousetrap from 'mousetrap'
import { addPauseToMousetrap } from '../vendor/mousetrap-pause'

addPauseToMousetrap(Mousetrap)

// Keyboard Navigation
var targets
var targetsLength
var currentIndex = 0
var jumpToIndexOnLoad
const keyNavCookieName = 'pfcdataKeyNav'
var searchBar, keyNavToggle, menuToggle

function bindElements () {
  searchBar = document.getElementById('search')
  keyNavToggle = document.getElementById('keynav-toggle')
  menuToggle = document.getElementById('menuToggle').querySelector('input')
}
bindElements()

function keyNavEnabled () {
  return document.cookie.includes(keyNavCookieName)
}

function setToggleText (txt) {
  keyNavToggle.querySelector('.text').textContent = txt
}

function clearTargets () {
  document.querySelectorAll('.keynav-target').forEach((el) => {
    el.classList.remove('keynav-target', 'pulsate')
  })
}

function enableKeyNav () {
  setCookie(keyNavCookieName, 1, 525600)
  Mousetrap.unpause()
  setToggleText('Disable Hot Keys')
  keyNav()
}

function disableKeyNav () {
  setCookie(keyNavCookieName, '', 0)
  clearTargets()
  setToggleText('Enable Hot Keys')
  Mousetrap.pause()
}

function toggleKeyNav () {
  if (keyNavEnabled()) {
    disableKeyNav()
  } else {
    enableKeyNav()
  }
}

export function keyNav (event, pulsate, preserveIndex) {
  if (!keyNavEnabled()) return
  bindElements()
  if (menuToggle.checked) {
    targets = Array.from(document.getElementById('hamburger-menu').querySelectorAll('a'))
    currentIndex = 0
  } else {
    targets = []
    document.querySelectorAll('a').forEach((link) => {
      if (link.hasAttribute('data-keynav-skip')) return
      targets.push(link)
    })
    targets.push(searchBar)

    if (jumpToIndexOnLoad > 0) {
      currentIndex = jumpToIndexOnLoad
      jumpToIndexOnLoad = undefined
    } else if (!preserveIndex) {
      var priorityLink = document.querySelectorAll('[data-keynav-priority]')[0]
      var i = targets.indexOf(priorityLink)
      currentIndex = i > 0 ? i : 0
    }
  }
  targetsLength = targets.length
  clearTargets()
  var currentTarget = targets[currentIndex]
  currentTarget.classList.add('keynav-target')
  currentTarget.focus()
  currentTarget.blur()
  if (pulsate) {
    currentTarget.classList.add('pulsate')
  }
}

Mousetrap.bind(['left', '['], function () {
  clearTargets()
  currentIndex--
  if (currentIndex < 0) {
    currentIndex = targetsLength - 1
  }
  targets[currentIndex].classList.add('keynav-target')
})

Mousetrap.bind(['right', ']'], function () {
  clearTargets()
  currentIndex++
  if (currentIndex >= targetsLength) {
    currentIndex = 0
  }
  targets[currentIndex].classList.add('keynav-target')
})

Mousetrap.bind('enter', function (e) {
  if (targets.length < currentIndex) {
    return
  }
  var currentTarget = targets[currentIndex]
  if (currentTarget.nodeName === 'INPUT') {
    currentTarget.focus()
    e.stopPropagation()
    e.preventDefault()
    return
  }
  if (currentTarget.id === 'keynav-toggle') {
    toggleKeyNav()
    return
  }
  var location = currentTarget.href
  if (location !== undefined) {
    if (currentTarget.dataset.preserveKeynavIndex) {
      jumpToIndexOnLoad = currentIndex
    }
    currentTarget.classList.add('activated')
    Turbolinks.visit(location)
  }
})

Mousetrap.bind('\\', function (e) {
  e.preventDefault()
  var topSearch = searchBar
  if (topSearch.classList.contains('keynav-target')) {
    topSearch.blur()
    clearTargets()
    keyNav(e, true, 0)
  } else {
    clearTargets()
    topSearch.classList.add('keynav-target')
    topSearch.focus()
  }
})

Mousetrap.bind('`', function () {
  toggleSun()
})

Mousetrap.bind('=', function (e) {
  toggleMenu(e)
  keyNav(e, true)
})

Mousetrap.bind('q', function () {
  clearTargets()
})

if (keyNavEnabled()) {
  Mousetrap.unpause()
} else {
  Mousetrap.pause()
}

keyNavToggle.querySelector('.text').textContent = keyNavEnabled() ? 'Disable Hot Keys' : 'Enable Hot Keys'

document.addEventListener('turbolinks:load', function (e) {
  closeMenu(e)
  if (keyNavEnabled()) {
    delete searchBar.autofocus
    keyNav(e, true)
  } else {
    searchBar.focus()
  }
})

keyNavToggle.addEventListener('click', (e) => {
  if (e.offsetX === 0) {
    // prevent duplicate click handling when turbolinks re-attaches handlers
    // TODO find a more semantic way to deal with this
    return
  }
  toggleKeyNav()
})

menuToggle.addEventListener('change', (e) => {
  if (keyNavEnabled()) {
    keyNav(e, true)
  }
})