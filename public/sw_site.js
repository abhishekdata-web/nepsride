const cacheName = 'v1';

// Call install event
self.addEventListener('install', e => {
    console.log('Service Worker: Installed');
})

// Activate event
self.addEventListener('activate', e => {
    console.log('Service Worker: Activated');

    //Remove unwanted caches
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== cacheName) {
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
        fetch(e.request)
            .then(res => {
                //Make copy/clone of response
                const resClone = res.clone();
                //Open cache
                caches
                    .open(cacheName)
                    .then(cache => {
                        //Add response to the cache
                        cache.put(e.request, resClone);
                    })
                return res;
            }).catch(err => caches.match(e.request).then(res => res))
    )
})