import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'CBoard - Local Network Sharing',
        short_name: 'CBoard',
        description: 'Share text and files between a Host and Receiver on your local network',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
    }
}
