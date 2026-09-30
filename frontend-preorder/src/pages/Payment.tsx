import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, MessageCircle, Receipt, Upload } from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../api/axios';
import QRImage from '../assets/QR.png';

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { invoiceNumber, dpAmount, customerName, orderDate, cancelToken } = location.state || {};
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!invoiceNumber) {
    return (
      <div className="grid min-h-screen place-items-center px-5 text-center">
        <div className="glass-card w-full max-w-lg rounded-[1.5rem] p-6 sm:p-8">
          <AlertCircle className="mx-auto mb-5 text-amber-500" size={54} />
          <h1 className="font-display text-[clamp(1.75rem,8vw,2.25rem)] font-black leading-tight">Data pembayaran tidak ditemukan</h1>
          <p className="mt-3 text-[#8a7c82]">Sesi pembayaran kedaluwarsa atau tidak valid.</p>
          <button onClick={() => navigate('/')} className="hipud-btn mt-5 min-h-11 px-6 font-black">Kembali ke Home</button>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.size > 5 * 1024 * 1024) {
      setFile(null);
      e.target.value = '';
      Swal.fire({ icon: 'warning', title: 'File terlalu besar', text: 'Maksimal ukuran bukti pembayaran adalah 5MB.' });
      return;
    }
    setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return Swal.fire({ icon: 'warning', title: 'Pilih bukti pembayaran', text: 'Upload file JPG/PNG terlebih dahulu.' });
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('orderId', invoiceNumber);
      formData.append('proofImage', file);
      await api.post('/payments', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIsSuccess(true);
    } catch (error) {
      console.error('Gagal upload bukti:', error);
      Swal.fire({ icon: 'error', title: 'Gagal mengunggah', text: 'Terjadi kesalahan sistem. Coba lagi atau hubungi admin.' });
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsApp = () => {
    const adminWA = '6285723891658';
    const message = `Halo Admin Hi Pud, saya ${customerName}. Saya sudah kirim bukti transfer DP untuk Invoice: *${invoiceNumber}*. Mohon dicek ya.`;
    window.open(`https://wa.me/${adminWA}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const cancelOrder = async () => {
    const result = await Swal.fire({ title: 'Batalkan pesanan?', text: 'Pesanan akan ditandai batal.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, batalkan', cancelButtonText: 'Kembali' });
    if (!result.isConfirmed) return;
    try {
      await api.put(`/orders/${invoiceNumber}/cancel`, { cancelToken });
      Swal.fire({ icon: 'success', title: 'Pesanan dibatalkan' });
      navigate('/');
    } catch {
      Swal.fire({ icon: 'error', title: 'Gagal membatalkan', text: 'Silakan hubungi admin.' });
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 md:px-10 md:py-8">
      <div className="mx-auto max-w-xl">
        <div className="glass-card overflow-hidden rounded-[1.5rem]">
          <div className="bg-[#fff9fb]/80 p-5 text-center sm:p-7">
            {isSuccess ? <CheckCircle className="mx-auto mb-4 text-[#f48fb1]" size={50} /> : <Receipt className="mx-auto mb-4 text-[#f48fb1]" size={50} />}
            <h1 className="font-display text-[clamp(1.75rem,8vw,2.25rem)] font-black leading-tight">{isSuccess ? 'Bukti Pembayaran Terkirim' : 'Konfirmasi Pembayaran'}</h1>
            <p className="mt-2 text-[#8a7c82]">Invoice <b>{invoiceNumber}</b></p>
            <p className="mt-1 text-sm text-[#8a7c82]">Tanggal pemesanan: <b>{orderDate ? new Date(orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</b></p>
          </div>

          {isSuccess ? (
            <div className="p-5 text-center sm:p-7">
              <p className="text-[#8a7c82]">Bukti pembayaran berhasil dikirim. Pesananmu sedang menunggu verifikasi admin melalui WhatsApp.</p>
              <div className="mt-6 flex flex-col gap-3">
                <button onClick={sendWhatsApp} className="hipud-btn inline-flex min-h-12 items-center justify-center gap-2 px-6 font-black"><MessageCircle size={20} /> Chat Admin</button>
                <button onClick={() => navigate('/')} className="hipud-outline-btn inline-flex min-h-12 items-center justify-center px-6 font-black">Kembali ke Home</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-7">
              <div className="rounded-[1.2rem] bg-[#f8dce8]/50 p-4 text-center">
                <p className="text-sm font-bold text-[#8a7c82]">Total DP yang harus dibayar</p>
                <p className="mt-1 font-display text-[clamp(1.9rem,9vw,2.75rem)] font-black text-[#964261]">Rp {Number(dpAmount).toLocaleString('id-ID')}</p>
              </div>
              <div className="rounded-[1.2rem] bg-white/70 p-4 text-center sm:p-5">
                <p className="mb-4 text-xs font-black uppercase tracking-[.2em] text-[#8a7c82]">Scan QRIS Berikut</p>
                <div className="mx-auto grid h-44 w-44 place-items-center rounded-2xl bg-white shadow-inner sm:h-52 sm:w-52">
                  <img src={QRImage} alt="QRIS Hi Pud" className="h-36 w-36 object-contain sm:h-44 sm:w-44" />
                </div>
                <p className="mt-5 text-sm text-[#8a7c82]">Atau transfer manual ke:</p>
                <p className="font-black text-[#3f2e35]">BCA 376138556</p>
                <p className="text-sm text-[#8a7c82]">A/N: An Ratu</p>
              </div>
              <div>
                <label className="hipud-label">Upload Bukti Transfer *</label>
                <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleFileChange} className="hipud-input mt-2" />
                <p className="mt-2 text-xs text-[#8a7c82]">Format JPG/PNG. Maksimal ukuran file 5MB.</p>
              </div>
              <button disabled={loading} className="hipud-btn inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 font-black disabled:opacity-60"><Upload size={20} /> {loading ? 'Mengirim...' : 'Kirim Bukti Pembayaran'}</button>
              <button type="button" onClick={sendWhatsApp} className="hipud-outline-btn inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 font-black"><MessageCircle size={20} /> Chat Admin</button>
              <button type="button" onClick={cancelOrder} className="w-full py-2 text-sm font-bold text-[#8a7c82] hover:text-red-500">Batalkan Pesanan Ini</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Payment;

