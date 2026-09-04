import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { TestSuiteResult } from '../types';
import {
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Cpu,
  Layers,
  Clock,
  Terminal,
  AlertTriangle
} from 'lucide-react';

export const TestRunnerView: React.FC = () => {
  const { addToast } = useApp();
  const [results, setResults] = useState<TestSuiteResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const data = await api.runAutomatedTests();
      setResults(data);
      if (data.failed === 0) {
        addToast('All Tests Passed', `Executed ${data.total} automated security assertions successfully.`, 'success');
      } else {
        addToast('Test Suite Notice', `${data.failed} assertions failed. Review diagnostics below.`, 'error');
      }
    } catch (err: any) {
      addToast('Execution Failed', err.message, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Automated System Verification & Test Suite
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            End-to-end regression validation for tenant data isolation, detection correlation, and security posture math
          </p>
        </div>
        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition-all"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
          <span>{isRunning ? 'Executing Test Harness...' : 'Execute Test Suite'}</span>
        </button>
      </div>

      {/* Summary Scorecard */}
      {results && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-xs text-slate-500">Total Assertions</span>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {results.total}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Passed</span>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {results.passed}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold">Failed</span>
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
              {results.failed}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500">Execution Time</span>
            <div className="text-2xl font-black font-mono text-cyan-500 mt-1">
              {results.durationMs} ms
            </div>
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-between items-center">
          <h3 className="font-bold text-xs text-slate-900 dark:text-white">Test Suite Breakdown</h3>
          <span className="text-xs font-mono text-slate-400">
            {results ? `Ran at ${new Date(results.timestamp).toLocaleTimeString()}` : 'Ready to execute'}
          </span>
        </div>

        {results ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {results.results.map((t, idx) => (
              <div key={idx} className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                        {t.category}
                      </span>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white font-mono">
                        {t.name}
                      </h4>
                    </div>
                    {t.error && (
                      <p className="text-xs font-mono text-rose-500 mt-1 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                        {t.error}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {t.durationMs}ms
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <Cpu className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <p>Click "Execute Test Suite" to run automated end-to-end verification against in-memory security services.</p>
          </div>
        )}
      </div>
    </div>
  );
};
