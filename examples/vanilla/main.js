import 'shipdot'

document.addEventListener('shipdot:read', (event) => console.log('Read:', event.detail.ids))
