import { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Minus, Plus, Receipt, ShoppingBag, Trash2, MessageCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../api/axios';
import { CartContext } from '../context/CartContext';

const faculties = [
  'Fakultas Kedokteran',
  'Fakultas Kedokteran Gigi',
  'Fakultas Matematika dan Ilmu Pengetahuan Alam',
  'Fakultas Pertanian',
  'Fakultas Peternakan',
  'Fakultas Ilmu Budaya',
  'Fakultas Ilmu Sosial dan Ilmu Politik',
  'Fakultas Ilmu Komunikasi',
  'Fakultas Keperawatan',
  'Fakultas Perikanan dan Ilmu Kelautan',
  'Fakultas Teknologi Industri Pertanian',
  'Fakultas Farmasi',
  'Fakultas Teknik Geologi',
  'Sekolah Bisnis dan Manajemen',
  'Lainnya',
];

type PickupMethod = 'pribadi' | 'stand_kencana' | 'danus';

const productionAddress = 'Rumah produksi Hipud - Komplek Duta Family C3, Parakanmuncang';
const standKencanaAddress = 'Stand Kencana - Jl. Teratai Raya Blok 9, depan Soto Rawon Kencana, Rancaekek';
const standKencanaTime = 'Maksimal 08:00';
const danusTime = '10:00-11:00';

const pickupOptions: Array<{ value: PickupMethod; label: string; description: string }> = [
  { value: 'pribadi', label: 'Pribadi', description: 'Pickup ke rumah produksi Hipud.' },
  { value: 'stand_kencana', label: 'Ambil Stand Kencana', description: 'Ambil di Stand Kencana maksimal jam 8 pagi.' },
  { value: 'danus', label: 'Danus', description: 'Diantar khusus area UNPAD Jatinangor.' },
];

const pickupMethodLabel = (method: PickupMethod) => {
  if (method === 'danus') return 'Danus';
  if (method === 'stand_kencana') return 'Ambil Stand Kencana';
  return 'Pribadi';
};

const getApiErrorMessage = (error: unknown) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Koneksi internet perangkat sedang terputus. Sambungkan internet lalu coba checkout lagi.';
  }

  if (typeof error === 'object' && error !== null) {
    const apiError = error as {
      code?: string;
      message?: string;
      response?: { data?: { message?: string; error?: string } };
    };

    if (apiError.response?.data?.message) return apiError.response.data.message;
    if (apiError.response?.data?.error) return apiError.response.data.error;

    if (apiError.code === 'ERR_NETWORK' || apiError.message === 'Network Error') {
      return 'Tidak bisa menghubungi server checkout. Pastikan internet aktif dan API Hipud bisa diakses, lalu coba lagi.';
    }
  }

  return null;
};

const tomorrowDateValue = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
};

const Checkout = () => {
  const navigate = useNavigate();
  const { cart, cartTotal, updateQuantity, removeFromCart, clearCart } = useContext(CartContext);
  const [loading, setLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    whatsappNumber: '',
    pickupMethod: 'pribadi' as PickupMethod,
    pickupDate: '',
    faculty: faculties[0],
    pickupTime: danusTime,
    pickupLocation: '',
    notes: '',
  });

  const dpAmount = useMemo(() => cartTotal * 0.5, [cartTotal]);
  const remainingAmount = cartTotal - dpAmount;

  if (cart.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center px-5 text-center">
        <div className="glass-card w-full max-w-lg rounded-[1.5rem] p-6 sm:p-8">
          <ShoppingBag className="mx-auto mb-5 text-[#f48fb1]" size={54} />
          <h1 className="font-display text-[clamp(1.75rem,8vw,2.25rem)] font-black text-[#3f2e35]">Keranjang masih kosong</h1>
          <p className="mt-3 text-[#8a7c82]">Pilih beberapa menu Hipud dulu sebelum checkout.</p>
          <button onClick={() => navigate('/')} className="hipud-btn mt-5 min-h-11 px-6 font-black">Lihat Menu</button>
        </div>
      </div>
    );
  }

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyNumbers = e.target.value.replace(/[^0-9]/g, '');
    setFormData({ ...formData, whatsappNumber: onlyNumbers });
  };

  const validateForm = () => {
    if (!formData.customerName.trim() || !formData.whatsappNumber.trim() || !formData.pickupDate) return false;
    if (formData.pickupMethod === 'danus' && (!formData.faculty || !formData.pickupLocation.trim())) return false;
    return true;
  };

  const submitOrder = async () => {
    if (!validateForm()) {
      return Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Lengkapi nama, WhatsApp, tanggal, dan detail pengambilan.' });
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return Swal.fire({
        icon: 'error',
        title: 'Koneksi terputus',
        text: 'Internet perangkat sedang offline. Sambungkan internet lalu coba checkout lagi.',
      });
    }

    setLoading(true);
    try {
      const address = formData.pickupMethod === 'danus'
        ? `Danus - ${formData.faculty}: ${formData.pickupLocation}`
        : formData.pickupMethod === 'stand_kencana'
          ? standKencanaAddress
          : productionAddress;

      const orderPayload = {
        customerName: formData.customerName,
        whatsappNumber: formData.whatsappNumber,
        address,
        pickupMethod: formData.pickupMethod,
        pickupDate: formData.pickupDate,
        faculty: formData.pickupMethod === 'danus' ? formData.faculty : null,
        pickupLocation: formData.pickupMethod === 'danus'
          ? formData.pickupLocation
          : formData.pickupMethod === 'stand_kencana'
            ? standKencanaAddress
            : productionAddress,
        pickupTime: formData.pickupMethod === 'danus'
          ? danusTime
          : formData.pickupMethod === 'stand_kencana'
            ? standKencanaTime
            : null,
        notes: formData.notes,
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, price: item.price })),
      };
      const response = await api.post('/orders', orderPayload);
      const resData = response.data.data;
      clearCart();
      navigate('/payment', { state: { invoiceNumber: resData.invoiceNumber, dpAmount: resData.dpAmount || dpAmount, customerName: formData.customerName, orderDate: resData.createdAt || new Date().toISOString(), cancelToken: resData.cancelToken } });
    } catch (error) {
      console.error('Gagal membuat pesanan:', error);
      Swal.fire({
        icon: 'error',
        title: 'Pesanan gagal',
        text: getApiErrorMessage(error) || 'Terjadi kesalahan saat memproses pesanan. Silakan coba lagi.',
      });
    } finally {
      setLoading(false);
    }
  };

  const OrderSummary = () => (
    <div className="glass-card sticky top-20 rounded-[1rem] p-2.5 sm:rounded-[1.5rem] sm:p-5 lg:top-24">
      <h2 className="font-display mb-2 flex items-center gap-1.5 text-base font-black sm:mb-4 sm:text-xl"><Receipt className="text-[#f48fb1]" /> Ringkasan Pesanan</h2>
      <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1 sm:max-h-[260px] sm:space-y-3">
        {cart.map((item) => (
          <div key={item.productId} className="rounded-[.8rem] bg-white/65 p-2 sm:rounded-[1.1rem] sm:p-3.5">
            <div className="flex justify-between gap-4">
              <div><p className="font-black text-[#3f2e35]">{item.name}</p><p className="text-xs text-[#8a7c82] sm:text-sm">Rp {item.price.toLocaleString('id-ID')} / pcs</p></div>
              <button onClick={() => removeFromCart(item.productId)} className="text-[#8a7c82] hover:text-red-500"><Trash2 size={17} /></button>
            </div>
            <div className="mt-2 flex items-center justify-between sm:mt-3">
              <div className="flex items-center gap-2 rounded-full bg-white p-1">
                <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-[#f8dce8] sm:h-8 sm:w-8"><Minus size={14} /></button>
                <span className="min-w-8 text-center font-black">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-[#f48fb1] text-white sm:h-8 sm:w-8"><Plus size={14} /></button>
              </div>
              <p className="font-black text-[#f48fb1]">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 rounded-[.8rem] bg-[#fff9fb]/80 p-2.5 sm:mt-4 sm:space-y-2.5 sm:rounded-[1.2rem] sm:p-4">
        <div className="flex justify-between text-sm"><span>Total Belanja</span><b>Rp {cartTotal.toLocaleString('id-ID')}</b></div>
        <div className="flex justify-between text-sm text-[#964261]"><span>DP 50%</span><b>Rp {dpAmount.toLocaleString('id-ID')}</b></div>
        <div className="flex justify-between text-sm"><span>Sisa Pembayaran</span><b>Rp {remainingAmount.toLocaleString('id-ID')}</b></div>
      </div>
      <button onClick={() => setShowReceipt(true)} className="hipud-btn mt-3 min-h-10 w-full px-3 text-sm font-black sm:mt-4 sm:min-h-12 sm:px-5">Preview Kwitansi</button>

      <button
        type="button"
        onClick={() => {
          const adminWA = '6285723891658';
          const message = 'Halo Admin Hi Pud, saya mau tanya-tanya dulu seputar pesanan di keranjang saya nih.';
          window.open(`https://wa.me/${adminWA}?text=${encodeURIComponent(message)}`, '_blank');
        }}
        className="hipud-outline-btn mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 px-3 text-sm font-black text-[#6d5963] sm:mt-3 sm:min-h-12 sm:px-5"
      >
        <MessageCircle size={18} className="text-[#f48fb1]" /> Tanya Admin via WA
      </button>
    </div>
  );

  return (
    <div className="checkout-compact min-h-screen px-2 py-3 sm:px-6 sm:py-6 md:px-10 md:py-8 xl:px-28">
      <button onClick={() => navigate('/')} className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/70 px-3 text-sm font-bold text-[#6d5963] sm:mb-5 sm:min-h-11 sm:px-4"><ArrowLeft size={18} /> Lanjut Belanja</button>
      <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[1fr_380px]">
        <section className="glass-card rounded-[1rem] p-2.5 sm:rounded-[1.5rem] sm:p-5 md:p-6">
          <div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#f48fb1] sm:text-sm">Checkout</p><h1 className="font-display text-xl font-black leading-tight sm:text-3xl">Informasi Pemesanan</h1><p className="hidden mt-2 text-sm text-[#8a7c82] sm:block">Almost there! Pesanan manismu sebentar lagi diproses.</p></div>
          <form className="space-y-2.5 sm:space-y-4" onSubmit={(e) => { e.preventDefault(); setShowReceipt(true); }}>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div><label className="hipud-label">Nama Lengkap *</label><input className="hipud-input mt-2" required placeholder="Nama pembeli" value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} /></div>
              <div><label className="hipud-label">Nomor WhatsApp *</label><input className="hipud-input mt-2" required placeholder="0812xxxx" value={formData.whatsappNumber} onChange={handleWhatsappChange} /></div>
            </div>

            <div>
              <label className="hipud-label">Metode Pengambilan *</label>
              <div className="mt-2 grid grid-cols-3 gap-1.5 sm:mt-3 sm:gap-3">
                {pickupOptions.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setFormData({
                      ...formData,
                      pickupMethod: option.value,
                      pickupTime: option.value === 'danus' ? danusTime : option.value === 'stand_kencana' ? standKencanaTime : '',
                    })}
                    className={`rounded-[.8rem] border p-2 text-left transition active:scale-[0.99] sm:rounded-[1.2rem] sm:p-4 ${formData.pickupMethod === option.value ? 'border-[#f48fb1] bg-[#f8dce8]/45' : 'border-white bg-white/60'}`}
                  >
                    <b>{option.label}</b>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-[#8a7c82] sm:text-sm sm:leading-relaxed">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {formData.pickupMethod === 'pribadi' ? (
              <div className="rounded-[.8rem] bg-[#ddefff]/55 p-2.5 sm:rounded-[1.2rem] sm:p-4">
                <p className="font-black text-[#50606e]">Rumah produksi Hipud</p>
                <p className="mt-1 text-xs text-[#50606e] sm:text-sm">Area Kabupaten Bandung / Rancaekek</p>
                <p className="mt-2 text-[10px] font-bold text-[#50606e] sm:mt-3 sm:text-xs">Alamat lengkap bisa dikonfirmasi kembali lewat WhatsApp admin.</p>
              </div>
            ) : formData.pickupMethod === 'stand_kencana' ? (
              <div className="rounded-[.8rem] bg-[#ddefff]/55 p-2.5 sm:rounded-[1.2rem] sm:p-4">
                <p className="font-black text-[#50606e]">Ambil di Stand Kencana</p>
                <p className="mt-1 text-xs text-[#50606e] sm:text-sm">{standKencanaAddress}</p>
                <p className="mt-2 text-[10px] font-black text-[#50606e] sm:mt-3 sm:text-xs">Pengambilan maksimal jam 8 pagi.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div><label className="hipud-label">Fakultas *</label><select className="hipud-input mt-2" value={formData.faculty} onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}>{faculties.map((f) => <option key={f}>{f}</option>)}</select></div>
                <div><label className="hipud-label">Jam Diantar</label><select className="hipud-input mt-2" value={formData.pickupTime} onChange={(e) => setFormData({ ...formData, pickupTime: e.target.value })}><option value={danusTime}>10.00-11.00 WIB</option></select></div>
                <div className="md:col-span-2"><label className="hipud-label">Lokasi Detail Danus *</label><input className="hipud-input mt-2" placeholder="Contoh: depan lobby fakultas" value={formData.pickupLocation} onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })} /></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:gap-4"><div><label className="hipud-label">Tanggal Pengiriman/Pengambilan *</label><input type="date" min={tomorrowDateValue()} className="hipud-input mt-2" required value={formData.pickupDate} onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })} /><p className="mt-2 text-xs font-bold text-[#8a7c82]">Pemesanan minimal H-24 jam sebelum tanggal pengambilan.</p></div><div><label className="hipud-label">Catatan Tambahan</label><input className="hipud-input mt-2" placeholder="Opsional" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div></div>
          </form>
        </section>
        <OrderSummary />
      </div>

      {showReceipt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#3f2e35]/40 p-4 backdrop-blur-sm">
          <div className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] p-4 sm:p-6">
            <div className="text-center"><CheckCircle className="mx-auto mb-3 text-[#f48fb1]" size={52} /><h2 className="font-display text-3xl font-black">Preview Kwitansi</h2><p className="mt-2 text-sm text-[#8a7c82]">Cek kembali pesanan sebelum lanjut ke pembayaran DP.</p></div>
            <div className="mt-5 space-y-3 rounded-[1.2rem] bg-white/65 p-4">
              <div className="grid gap-3 border-b border-pink-100 pb-4 text-sm md:grid-cols-2"><p><b>Nama:</b> {formData.customerName || '-'}</p><p><b>WhatsApp:</b> {formData.whatsappNumber || '-'}</p><p><b>Metode:</b> {pickupMethodLabel(formData.pickupMethod)}</p><p><b>Tanggal:</b> {formData.pickupDate || '-'}</p></div>
              {cart.map((item) => <div key={item.productId} className="flex justify-between text-sm"><span>{item.quantity}x {item.name}</span><b>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</b></div>)}
              <div className="border-t border-pink-100 pt-4"><div className="flex justify-between"><span>Total</span><b>Rp {cartTotal.toLocaleString('id-ID')}</b></div><div className="mt-2 flex justify-between text-[#964261]"><span>DP 50%</span><b>Rp {dpAmount.toLocaleString('id-ID')}</b></div><div className="mt-2 flex justify-between"><span>Sisa</span><b>Rp {remainingAmount.toLocaleString('id-ID')}</b></div></div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button onClick={() => setShowReceipt(false)} className="hipud-outline-btn flex-1 min-h-11 px-5 font-black">Kembali Edit</button><button onClick={submitOrder} disabled={loading} className="hipud-btn flex-1 min-h-11 px-5 font-black disabled:opacity-60">{loading ? 'Memproses...' : 'Konfirmasi & Bayar DP'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;

