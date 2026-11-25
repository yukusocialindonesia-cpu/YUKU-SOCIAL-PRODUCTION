import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, ChevronDown, Search, X, Check } from 'lucide-react';
import {
  buildGroupedCityOptions,
  doesCityOptionMatchQuery,
  DynamicCityGroup,
} from '../../utils/cities';

interface LocationFilterProps {
  selectedCity: string;
  talentCities: Array<string | undefined | null>;
  onChangeCity: (city: string) => void;
}

export const LocationFilter: React.FC<LocationFilterProps> = ({
  selectedCity,
  talentCities,
  onChangeCity,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownTop, setDropdownTop] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const groupedCities: DynamicCityGroup[] = useMemo(
    () => buildGroupedCityOptions(talentCities),
    [talentCities]
  );

  // Cities that currently have active talents (highlighted dynamically at the top when no search query)
  const activeTalentCities = useMemo(() => {
    const items = groupedCities
      .flatMap((g) => g.items)
      .filter((item) => item.talentCount > 0)
      .sort((a, b) => b.talentCount - a.talentCount || a.name.localeCompare(b.name, 'id'));
    return items;
  }, [groupedCities]);

  const filteredGroups = useMemo(() => {
    const q = citySearch.trim();
    if (!q) return groupedCities;

    return groupedCities
      .map((group) => ({
        region: group.region,
        items: group.items.filter((item) =>
          doesCityOptionMatchQuery(item.name, group.region, q)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedCities, citySearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 30);
    } else {
      setCitySearch('');
    }
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;

    const updateDropdownPosition = () => {
      if (triggerRef.current) {
        setDropdownTop(triggerRef.current.getBoundingClientRect().bottom + 8);
      }
    };

    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, { passive: true });
    window.addEventListener('resize', updateDropdownPosition);

    return () => {
      window.removeEventListener('scroll', updateDropdownPosition);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]);

  const handleSelect = (city: string) => {
    onChangeCity(city);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (!isOpen && triggerRef.current) {
              const rect = triggerRef.current.getBoundingClientRect();
              setDropdownTop(rect.bottom + 8);
            }
            setIsOpen((prev) => !prev);
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Filter lokasi kota"
          className={`w-full min-h-11 sm:min-h-[46px] pl-8 sm:pl-9 pr-8 sm:pr-14 py-1.5 sm:py-2.5 text-xs sm:text-sm bg-white border rounded-xl text-left shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
            isOpen
              ? 'border-purple-400 bg-white shadow-[0_12px_28px_-16px_rgba(124,58,237,0.55)]'
              : selectedCity !== 'Semua Kota'
              ? 'border-purple-300/80 bg-gradient-to-r from-violet-50/90 to-fuchsia-50/70 text-purple-950 font-semibold'
              : 'border-slate-200 hover:bg-slate-100/70 text-slate-700'
          }`}
        >
          <MapPin className="w-4 h-4 text-purple-700 absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <span className="truncate">{selectedCity}</span>
        </button>

        {selectedCity !== 'Semua Kota' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeCity('Semua Kota');
            }}
            aria-label="Hapus filter kota"
            className="absolute right-7 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <ChevronDown
          className={`w-4 h-4 text-slate-400 absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-purple-700' : ''
          }`}
        />
      </div>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Daftar kota di Indonesia"
          style={{ "--dropdown-top": `${dropdownTop}px` } as React.CSSProperties}
          className="fixed top-[var(--dropdown-top)] z-[60] left-4 right-4 w-auto max-w-none bg-white rounded-2xl border border-slate-200 shadow-[0_18px_48px_-20px_rgba(15,23,42,0.35)] overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[min(22rem,calc(100vw-2rem))] sm:max-w-[calc(100vw-2rem)] sm:rounded-3xl sm:bg-white sm:border-white/80 sm:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.42)]"
        >
          {/* City Search Bar */}
          <div className="p-3 border-b border-slate-100 bg-violet-50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Cari kota (misal: Jaksel, Bandung, Bali)..."
                className="w-full min-h-11 sm:min-h-0 pl-8 pr-7 py-2.5 text-base sm:text-xs bg-white/90 border border-slate-200/80 rounded-xl shadow-inner focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              />
              {citySearch && (
                <button
                  type="button"
                  onClick={() => setCitySearch('')}
                  aria-label="Bersihkan pencarian kota"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-2 space-y-2 text-xs">
            {/* All Cities Option */}
            <button
              type="button"
              role="option"
              aria-selected={selectedCity === 'Semua Kota'}
              onClick={() => handleSelect('Semua Kota')}
              className={`w-full min-h-11 px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                selectedCity === 'Semua Kota'
                  ? 'bg-purple-50 text-purple-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-50 font-medium'
              }`}
            >
              <span>Semua Kota di Indonesia</span>
              {selectedCity === 'Semua Kota' && <Check className="w-3.5 h-3.5 text-purple-700" />}
            </button>

            {/* Quick Section: Cities with Active Talents */}
            {!citySearch.trim() && activeTalentCities.length > 0 && (
              <div className="pt-1 border-t border-slate-100">
                <div className="px-3 py-1 text-[11px] font-bold text-purple-800">
                  Kota dengan Talent Tersedia
                </div>
                <div className="space-y-0.5">
                  {activeTalentCities.map((item) => {
                    const isSelected = selectedCity.toLowerCase() === item.name.toLowerCase();
                    return (
                      <button
                        key={`active-${item.name}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(item.name)}
                        className={`w-full min-h-11 px-3 py-2.5 sm:py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-purple-50 text-purple-900 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="text-[11px] font-mono tabular-nums text-purple-700 shrink-0">
                          {item.talentCount} Talent
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grouped Indonesian Cities */}
            {filteredGroups.length === 0 ? (
              <div className="py-6 text-center text-slate-500">
                Kota &ldquo;{citySearch}&rdquo; tidak ditemukan.
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.region} className="pt-1 border-t border-slate-100">
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-500">
                    {group.region}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isSelected = selectedCity.toLowerCase() === item.name.toLowerCase();
                      return (
                        <button
                          key={`${group.region}-${item.name}`}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelect(item.name)}
                          className={`w-full min-h-11 px-3 py-2.5 sm:py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-purple-50 text-purple-900 font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{item.name}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            {item.talentCount > 0 && (
                              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                                {item.talentCount}
                              </span>
                            )}
                            {isSelected && <Check className="w-3.5 h-3.5 text-purple-700" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
