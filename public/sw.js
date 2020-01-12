const cacheName = 'v6';

const cacheAssets = [
    '/css/style.css',
    '/css/bootswatch.min.css',
    '/css/animate.min.css',
    '/offline',
    '/img/loading.svg',
    '/img/priceloader.svg',

    '/',
    '/your-rides',
    '/admin/upcoming-ride',
    '/admin/myaccount',
    '/earnwithus',
    '/admin-driver-register',
    '/admin-login',
    '/admin-register'
]

// Call install event
self.addEventListener('install', e => {
    console.log('Service Worker: Installed');

    e.waitUntil(
        caches
            .open(cacheName)
            .then(cache => {
                console.log('Service Worker: Caching Files');
                cache.addAll(cacheAssets);
            })
            .then(() => self.skipWaiting())
    )
})

// Activate event
self.addEventListener('activate', e => {
    console.log('Service Worker: Activated');

    //Remove unwanted caches
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if(cache !== cacheName){
                        console.log('Service Worker: Clearing Old Cache');
                        return caches.delete(cache)
                    }
                })
            )
        })
    )
})

//Call fetch event
self.addEventListener('fetch', e => {
    console.log('Service Worker: Fetching');

    e.respondWith(
        caches.match(e.request).then(cacheRes => {
            return cacheRes || fetch(e.request)
        }).catch(() => caches.match('/offline'))
    )
})