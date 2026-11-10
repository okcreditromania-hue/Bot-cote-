import React from 'react';
import { CountryCode, CountryInfo } from '../types/saspay';
import { COUNTRIES_LIST } from '../data/countries';
import { MapPin, Sparkles, Check, Globe } from 'lucide-react';

interface CountryDetectorBannerProps {
  selectedCountry: CountryInfo;
  onSelectCountry: (code: CountryCode) => void;
  isAutoDetected: boolean;
}

export const CountryDetectorBanner: React.FC<CountryDetectorBannerProps> = ({
  selectedCountry,
  onSelectCountry,
  isAutoDetected,
}) => {
  return (
    <div className="bg-white border-b border-slate-200 py-4 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Detection info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  Pays sélectionné : <span className="text-base mr-1">{selectedCountry.flag}</span>
                  <strong>{selectedCountry.name}</strong>
                </span>
                {isAutoDetected ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                    Détecté automatiquement
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Sélection manuelle
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Devise : <strong className="text-slate-800">{selectedCountry.currency}</strong> · Indicatif :{' '}
                <strong className="text-slate-800">{selectedCountry.phonePrefix}</strong> ·{' '}
                {selectedCountry.operators.length} opérateurs actifs
              </div>
            </div>
          </div>

          {/* Right: Quick 6-Country Selector with flags */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-medium text-slate-400 mr-1 hidden sm:inline whitespace-nowrap">
              Changer de pays :
            </span>
            {COUNTRIES_LIST.map((country) => {
              const isCurrent = country.code === selectedCountry.code;
              return (
                <button
                  key={country.code}
                  onClick={() => onSelectCountry(country.code)}
                  title={`${country.name} (${country.currency})`}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isCurrent
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span className="text-sm">{country.flag}</span>
                  <span className="hidden sm:inline">{country.name}</span>
                  {isCurrent && <Check className="w-3 h-3 text-white ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
