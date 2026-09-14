import Link from 'next/link'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getPropertyDetail, getSimilarProperties } from '@/lib/propertyDetails'
import { PROPERTIES } from '@/lib/properties'
import PropertyGallery from '@/components/property/PropertyGallery'
import AboutSection from '@/components/property/AboutSection'
import ActionCard from '@/components/property/ActionCard'
import RentEstimateGauge from '@/components/property/RentEstimateGauge'
import LandlordCard from '@/components/property/LandlordCard'
import OpenRequestsCard from '@/components/property/OpenRequestsCard'
import ReviewsSection from '@/components/property/ReviewsSection'
import PropertyCard from '@/components/discovery/PropertyCard'

const PropertyMap = dynamic(() => import('@/components/discovery/PropertyMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-sand text-sm text-charcoal/50">
      Loading map…
    </div>
  ),
})

export function generateStaticParams() {
  return PROPERTIES.map((p) => ({ id: p.id }))
}

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const property = getPropertyDetail(params.id)
  if (!property) notFound()

  const similar = getSimilarProperties(property.id, 4)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-charcoal/10 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link 
              href="/explore" 
              className="flex items-center gap-2 text-sm font-medium text-charcoal/70 hover:text-rust transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to results
            </Link>
            
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-rust transition-colors">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                  <path d="M15 8a3 3 0 11-6 0 3 3 0 016 0zM12 2v4M16.24 7.76l2.83-2.83M18 12h-4M16.24 16.24l2.83 2.83M12 18v-4M7.76 16.24l-2.83 2.83M6 12H2M7.76 7.76L4.93 4.93" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Share
              </button>
              
              <button className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-rust transition-colors">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                  <path d="M10 2v6l5-3-5-3zM10 2L5 5l5 3V2zM5 5v11a2 2 0 002 2h6a2 2 0 002-2V5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Save
              </button>
              
              <button className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-rust transition-colors">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                  <path d="M3 3l1.415 14.142A2 2 0 006.41 19h7.18a2 2 0 001.995-1.858L17 3m-4 4v8m-6-8v8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Gallery */}
            <PropertyGallery images={property.images} alt={property.title} verified={property.verified} />

            {/* Title & Location */}
            <div>
              <h1 className="font-display text-3xl font-bold text-charcoal">{property.title}</h1>
              <p className="mt-1 text-base text-charcoal/60">{property.neighborhood}, Addis Ababa</p>
              <div className="mt-2 flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rust">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-semibold text-charcoal">{property.rating}</span>
                <span className="text-sm text-charcoal/50">({property.reviewCount} reviews)</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-5 gap-3">
              <div className="flex flex-col items-center gap-2 rounded-lg border border-charcoal/10 bg-white px-4 py-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-rust">
                  <path d="M3 12h18M3 12v7a2 2 0 002 2h14a2 2 0 002-2v-7M3 12V9a2 2 0 012-2h14a2 2 0 012 2v3M7 16h.01M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-center">
                  <p className="text-lg font-bold text-charcoal">{property.beds}</p>
                  <p className="text-xs text-charcoal/60">Beds</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 rounded-lg border border-charcoal/10 bg-white px-4 py-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-rust">
                  <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M4 10h16v3a7 7 0 01-7 7v0a7 7 0 01-7-7v-3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-center">
                  <p className="text-lg font-bold text-charcoal">{property.baths}</p>
                  <p className="text-xs text-charcoal/60">Baths</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 rounded-lg border border-charcoal/10 bg-white px-4 py-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-rust">
                  <path d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2M16 4h2a2 2 0 012 2v2M16 20h2a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-center">
                  <p className="text-lg font-bold text-charcoal">{property.sizeSqm}</p>
                  <p className="text-xs text-charcoal/60">m²</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 rounded-lg border border-charcoal/10 bg-white px-4 py-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-rust">
                  <path d="M3 21h18M5 21V7l8-4v18M17 9h4a2 2 0 012 2v10M9 9v.01M9 12v.01M9 15v.01M13 9v.01M13 12v.01M13 15v.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-bold text-charcoal">Apartment</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 rounded-lg border border-charcoal/10 bg-white px-4 py-4">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-rust/10">
                  <span className="text-sm font-bold text-rust">P</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-charcoal">Parking</p>
                </div>
              </div>
            </div>

            {/* About This Home */}
            <div className="rounded-lg border border-charcoal/10 bg-white p-6">
              <h2 className="font-display text-lg font-semibold text-charcoal">About this home</h2>
              <AboutSection description={property.description} />
            </div>

            {/* Amenities */}
            <div className="rounded-lg border border-charcoal/10 bg-white p-6">
              <h2 className="font-display text-lg font-semibold text-charcoal">Amenities</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {property.amenities.map((amenity) => (
                  <div key={amenity} className="flex items-center gap-2 rounded-lg border border-charcoal/10 px-3 py-2">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rust">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-charcoal/80">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="rounded-lg border border-charcoal/10 bg-white p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-charcoal">Location</h2>
                  <p className="mt-1 text-sm text-charcoal/70">{property.neighborhood}, Addis Ababa</p>
                  <p className="mt-0.5 text-xs text-charcoal/50">Close to {property.nearby.join(', ')}</p>
                </div>
                <Link
                  href="/explore"
                  className="text-sm font-medium text-rust hover:text-rust-dark transition-colors"
                >
                  View full map
                </Link>
              </div>
              <div className="mt-4 h-80 overflow-hidden rounded-lg">
                <PropertyMap properties={[property]} />
              </div>
            </div>

            {/* Landlord & Open Requests */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <LandlordCard landlord={property.landlord} />
              <OpenRequestsCard requests={property.openRequests} />
            </div>

            {/* Reviews & Ratings */}
            <ReviewsSection propertyId={property.id} />

            {/* Similar Properties */}
            {similar.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold text-charcoal">Similar Properties</h2>
                <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {similar.map((p) => (
                    <PropertyCard key={p.id} property={p} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
            <ActionCard
              propertyId={property.id}
              propertyTitle={property.title}
              priceEtb={property.priceEtb}
              depositEtb={property.depositEtb}
            />

            <div className="rounded-lg border border-charcoal/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-rust">Powered by HomeLink AI</p>
              <h3 className="mt-2 font-display text-base font-semibold text-charcoal">AI Fair-Rent Estimate</h3>
              <div className="mt-4">
                <RentEstimateGauge estimate={property.rentEstimate} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
