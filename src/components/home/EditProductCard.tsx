import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types';
import { getOptimizedImageUrl } from '@/lib/cloudinary';

function getTotalStock(product: Product): number {
  return product.sizes
    ? product.sizes.reduce((acc, s) => acc + (product.stock_quantity?.[s] || 0), 0)
    : 0;
}

/**
 * EditProductCard — pure Server Component.
 * Renders a product card with lazy-loaded images and stock badge.
 * No client JS cost at all.
 */
export default function EditProductCard({
  product,
  isHeroMobile,
}: {
  product: Product;
  isHeroMobile?: boolean;
}) {
  const images = product.images || [];
  const primaryImage = images[0] || '';
  const secondaryImage = images[1] || '';
  const hasSecond = Boolean(secondaryImage);
  const totalStock = getTotalStock(product);
  const showLowStock = totalStock > 0 && totalStock < 5;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col bg-transparent w-full text-left"
      aria-label={`View ${product.name} — ₹${(product.price / 100).toLocaleString('en-IN')}`}
    >
      <div className="relative overflow-hidden rounded-sm bg-zinc-950 aspect-[4/5] w-full border border-white/[0.06] group-hover:border-white/20 transition-colors duration-300">
        {/* Primary image */}
        <Image
          src={getOptimizedImageUrl(primaryImage, isHeroMobile ? 800 : 500)}
          alt={product.name}
          fill
          sizes={isHeroMobile ? '(max-width: 768px) 100vw, 25vw' : '(max-width: 768px) 50vw, 25vw'}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
        {/* Secondary image — hover swap on desktop */}
        {hasSecond && (
          <Image
            src={getOptimizedImageUrl(secondaryImage, isHeroMobile ? 800 : 500)}
            alt={`${product.name} alternate view`}
            fill
            sizes={isHeroMobile ? '(max-width: 768px) 100vw, 25vw' : '(max-width: 768px) 50vw, 25vw'}
            loading="lazy"
            className="object-cover absolute inset-0 transition-opacity duration-300 hover-swap-image"
            style={{ opacity: 0 }}
          />
        )}

        {/* Low Stock Scarcity Pill */}
        {showLowStock && (
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <span className="bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-mono font-medium tracking-wide">
              Only {totalStock} left
            </span>
          </div>
        )}

        {/* Bottom subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Details */}
      <div className="pt-2.5 pb-1 flex flex-col space-y-0.5 text-left">
        <h3 className="text-xs font-medium text-white/90 uppercase tracking-wide truncate group-hover:text-white transition-colors duration-200">
          {product.name}
        </h3>
        <div className="flex items-baseline font-mono pt-0.5">
          <span className="text-sm font-black text-white tracking-tight">
            ₹{(product.price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </Link>
  );
}
