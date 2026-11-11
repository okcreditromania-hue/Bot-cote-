import React from 'react';
import { COUNTRIES_LIST } from '../data/countries';
import { CountryCode, CountryInfo } from '../types/saspay';
import { ShieldCheck, Check, Smartphone, ArrowRight } from 'lucide-react';

interface SupportedOperatorsSectionProps {
  onSelectCountry: (code: CountryCode) => void;
}

export const SupportedOperatorsSection: React.FC<SupportedOperatorsSectionProps> = ({
  onSelectCountry,
}) => {
  return (
    <section id="operators" className="py-16 bg-slate-100/70 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 mb-3">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Couverture Mobile Money Afrique de l'Ouest & Centrale</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            6 Pays & Opérateurs Mobile Money Activés
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed text-balance">
            Chaque pays dispose de ses réseaux certifiés avec prélèvement instantané par push USSD et API Softpay.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {COUNTRIES_LIST.map((country) => (
            <div
              key={country.code}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{country.flag}</span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{country.name}</h3>
                      <span className="text-xs text-slate-500 font-mono">
                        Indicatif : {country.phonePrefix}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-700">
                    {country.currency}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Opérateurs autorisés :
                  </span>
                  <div className="space-y-2">
                    {country.operators.map((op) => (
                      <div
                        key={op.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${op.colorBg} ${op.colorText}`}
                          >
                            {op.logoText}
                          </span>
                          <span className="font-semibold text-slate-800">{op.name}</span>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-mono font-bold flex items-center gap-0.5">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Actif
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCountry(country.code);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Encaisser au {country.name}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
