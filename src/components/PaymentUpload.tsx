'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface PaymentUploadProps {
  onUpload: (file: File) => void;
  onVerify?: (result: any) => void;
  expectedAmount?: number;
}

export default function PaymentUpload({
  onUpload,
  onVerify,
  expectedAmount,
}: PaymentUploadProps) {
  const { tr } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Show preview
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);

      onUpload(file);

      // Auto-verify with OCR
      if (onVerify) {
        setVerifying(true);
        try {
          const formData = new FormData();
          formData.append('screenshot', file);
          if (expectedAmount) {
            formData.append('expectedAmount', expectedAmount.toString());
          }

          const res = await fetch('/api/ocr/verify', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          if (data.success) {
            setVerificationResult(data.data);
            onVerify(data.data);
          }
        } catch (error) {
          console.error('OCR verification failed:', error);
        } finally {
          setVerifying(false);
        }
      }
    },
    [onUpload, onVerify, expectedAmount]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragActive
            ? 'border-purple-500 bg-purple-500/10 shadow-glow-sm'
            : preview
            ? 'border-emerald-500/50 bg-emerald-500/10'
            : 'border-purple-500/20 hover:border-purple-500/50 bg-[#0a0a1f]/40 hover:bg-dark-800/50'
        }`}
      >
        <input {...getInputProps()} />

        {preview ? (
          <div className="space-y-3">
            <img
              src={preview}
              alt="Payment screenshot"
              className="max-h-48 w-auto mx-auto rounded-lg border border-purple-500/20 shadow-lg"
            />
            <p className="text-sm text-gray-400">
              {tr('Click or drag to replace', 'အစားထိုးရန် နှိပ်ပါ သို့မဟုတ် ဆွဲထည့်ပါ')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto w-16 h-16 bg-[#0a0a1f] border border-purple-500/20 rounded-2xl flex items-center justify-center">
              {isDragActive ? (
                <Image className="w-8 h-8 text-purple-400" />
              ) : (
                <Upload className="w-8 h-8 text-gray-500" />
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                {isDragActive
                  ? tr('Drop your screenshot here', 'Screenshot ကိုဒီနေရာတွင်ချပါ')
                  : tr('Upload payment screenshot', 'ငွေပေးချေမှု screenshot တင်ပါ')}
              </p>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                {tr('Kpay, WaveMoney, CBPay, AYA Pay • PNG, JPG, WebP • Max 5MB', 'Kpay, WaveMoney, CBPay, AYA Pay • PNG, JPG, WebP • အများဆုံး 5MB')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* OCR Verification Result */}
      {verifying && (
        <div className="flex items-center space-x-3 px-5 py-4 bg-dark-800 border border-dark-600 rounded-xl">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          <span className="text-sm text-gray-300 font-medium">
            {tr('Verifying payment screenshot...', 'ငွေပေးချေမှု screenshot စစ်ဆေးနေသည်...')}
          </span>
        </div>
      )}

      {verificationResult && !verifying && (
        <div
          className={`p-5 rounded-xl border-2 ${
            verificationResult.verified
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <div className="flex items-start space-x-4">
            {verificationResult.verified ? (
              <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
            )}
            <div className="space-y-2">
              <p
                className={`text-base font-bold ${
                  verificationResult.verified
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {verificationResult.verified
                  ? tr('Payment Verified!', 'ငွေပေးချေမှု အတည်ပြုပြီးပါပြီ!')
                  : tr('Manual review may be needed', 'လူကြီးမင်းအတွက် လူကိုယ်တိုင်စစ်ဆေးရန်လိုနိုင်သည်')}
              </p>
              {verificationResult.transactionId && (
                <p className="text-sm text-gray-400">
                  {tr('Transaction ID:', 'ငွေလွှဲ ID:')}{' '}
                  <span className="text-white font-mono">
                    {verificationResult.transactionId}
                  </span>
                </p>
              )}
              {verificationResult.amount && (
                <p className="text-sm text-gray-400">
                  {tr('Amount:', 'ပမာဏ:')}{' '}
                  <span className="text-white font-mono">
                    {parseInt(verificationResult.amount).toLocaleString()} MMK
                  </span>
                </p>
              )}
              <p className="text-sm text-gray-500">
                {tr('Confidence:', 'ယုံကြည်နိုင်မှု:')} {Math.round(verificationResult.confidence)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
