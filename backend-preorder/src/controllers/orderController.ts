import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import prisma from '../config/database.js';
import { buildReceiptPDF } from '../services/pdfService.js';

const ORDER_STATUSES = ['PENDING', 'DIPROSES', 'SELESAI', 'DIBATALKAN'] as const;
const PICKUP_METHODS = ['danus', 'pribadi', 'stand_kencana'] as const;
const DANUS_DELIVERY_TIME = '10:00-11:00';
const STAND_KENCANA_TIME = 'Maksimal 08:00';
const PRODUCTION_ADDRESS = 'Rumah produksi Hi Pud - Komplek Duta Family C3, Parakanmuncang';
const STAND_KENCANA_ADDRESS = 'Stand Kencana - Jl. Teratai Raya Blok 9, depan Soto Rawon Kencana, Rancaekek';
const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
type OrderStatus = typeof ORDER_STATUSES[number];
type PickupMethod = typeof PICKUP_METHODS[number];

const orderInclude = {
  items: {
    include: {
      product: true
    }
  }
};

const isOrderStatus = (status: unknown): status is OrderStatus => {
  return typeof status === 'string' && ORDER_STATUSES.includes(status as OrderStatus);
};

const isPickupMethod = (method: unknown): method is PickupMethod => {
  return typeof method === 'string' && PICKUP_METHODS.includes(method as PickupMethod);
};

const parseDateOnly = (value: string | Date | null | undefined) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const maxDate = (dates: Date[]) => new Date(Math.max(...dates.map((date) => date.getTime())));
const minDate = (dates: Date[]) => new Date(Math.min(...dates.map((date) => date.getTime())));

const formatDate = (date: Date) => date.toLocaleDateString('id-ID', {
  timeZone: JAKARTA_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const getJakartaDateString = (value: string | Date | null | undefined) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
};

const buildBatchWindow = (products: Array<{ poOpenDate: Date | null; poCloseDate: Date | null }>) => {
  const validWindows = products
    .map((product) => {
      const orderStartDate = parseDateOnly(product.poOpenDate);
      const orderEndDate = parseDateOnly(product.poCloseDate);

      if (!orderStartDate || !orderEndDate || orderEndDate < orderStartDate) return null;

      return {
        orderStartDate,
        orderEndDate,
        readyStartDate: addDays(orderStartDate, 1),
        readyEndDate: addDays(orderEndDate, 1)
      };
    })
    .filter((window): window is {
      orderStartDate: Date;
      orderEndDate: Date;
      readyStartDate: Date;
      readyEndDate: Date;
    } => Boolean(window));

  if (validWindows.length === 0) return undefined;

  const batchWindow = {
    orderStartDate: minDate(validWindows.map((window) => window.orderStartDate)),
    orderEndDate: maxDate(validWindows.map((window) => window.orderEndDate)),
    readyStartDate: minDate(validWindows.map((window) => window.readyStartDate)),
    readyEndDate: maxDate(validWindows.map((window) => window.readyEndDate))
  };

  return batchWindow;
};

const getActiveBatchWindow = async () => {
  const scheduledProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      isOrderable: true,
      poOpenDate: { not: null },
      poCloseDate: { not: null }
    },
    select: {
      poOpenDate: true,
      poCloseDate: true
    }
  });

  return buildBatchWindow(scheduledProducts);
};

const normalizeOrderItems = (items: unknown) => {
  if (!Array.isArray(items)) return null;

  const grouped = new Map<number, number>();

  for (const item of items) {
    const value = item as { productId?: unknown; quantity?: unknown };
    const productId = Number(value.productId);
    const quantity = Number(value.quantity);

    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      return null;
    }

    grouped.set(productId, (grouped.get(productId) || 0) + quantity);
  }

  return Array.from(grouped, ([productId, quantity]) => ({ productId, quantity }));
};

// Fitur Membuat Pesanan Baru (Checkout)
export const createOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      customerName,
      whatsappNumber,
      address,
      pickupMethod,
      pickupDate,
      pickupTime,
      pickupLocation,
      faculty,
      notes,
      items
    } = req.body;

    const normalizedItems = normalizeOrderItems(items);

    if (!customerName || !whatsappNumber || !normalizedItems || normalizedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Data pesanan belum lengkap.' });
    }

    if (!isPickupMethod(pickupMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Metode pengambilan hanya boleh Danus, Pribadi, atau Ambil Stand Kencana.'
      });
    }

    if (!pickupDate) {
      return res.status(400).json({
        success: false,
        message: 'Tanggal pengambilan wajib dipilih.'
      });
    }

    if (pickupMethod === 'danus') {
      if (!faculty || !pickupLocation) {
        return res.status(400).json({
          success: false,
          message: 'Fakultas dan lokasi detail wajib diisi untuk Danus.'
        });
      }

      if (pickupTime !== DANUS_DELIVERY_TIME) {
        return res.status(400).json({
          success: false,
          message: 'Jam Danus hanya tersedia pukul 10.00-11.00 WIB.'
        });
      }
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: normalizedItems.map((item) => item.productId) },
        isActive: true,
        isOrderable: true
      }
    });

    if (products.length !== normalizedItems.length) {
      return res.status(400).json({ success: false, message: 'Ada produk yang tidak valid atau belum open order.' });
    }

    const batchWindow = await getActiveBatchWindow();

    const today = getJakartaDateString(new Date());
    const selectedPickupDate = getJakartaDateString(pickupDate);

    if (!selectedPickupDate) {
      return res.status(400).json({ success: false, message: 'Format tanggal pengambilan tidak valid.' });
    }

    if (!today) {
      return res.status(500).json({ success: false, message: 'Gagal membaca tanggal server.' });
    }

    if (selectedPickupDate <= today) {
      return res.status(400).json({
        success: false,
        message: 'Pemesanan minimal H-1 sebelum tanggal pengambilan.'
      });
    }

    if (batchWindow) {
      const orderStartDate = getJakartaDateString(batchWindow.orderStartDate);
      const orderEndDate = getJakartaDateString(batchWindow.orderEndDate);

      if (!orderStartDate || !orderEndDate) {
        return res.status(500).json({ success: false, message: 'Gagal membaca jadwal batch.' });
      }

      if (today < orderStartDate || today > orderEndDate) {
        return res.status(400).json({
          success: false,
          message: `Pemesanan batch ini dibuka dari ${formatDate(batchWindow.orderStartDate)} sampai ${formatDate(batchWindow.orderEndDate)}.`
        });
      }
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const orderItems = normalizedItems.map((item) => {
      const product = productById.get(item.productId);
      if (!product) throw new Error(`Produk ${item.productId} tidak ditemukan setelah validasi.`);

      return {
        productId: product.id,
        quantity: item.quantity,
        price: Number(product.price),
        subtotal: Number(product.price) * item.quantity
      };
    });

    const totalAmount = orderItems.reduce((total, item) => total + item.subtotal, 0);
    const dpAmount = totalAmount / 2;

    const lastOrder = await prisma.order.findFirst({ orderBy: { id: 'desc' } });
    let nextNumber = 1;
    if (lastOrder && lastOrder.invoiceNumber.startsWith('INV-')) {
      const lastNumber = parseInt(lastOrder.invoiceNumber.replace('INV-', ''), 10);
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }

    const invoiceNumber = `INV-${nextNumber.toString().padStart(3, '0')}`;
    const cancelToken = randomUUID();

    const newOrder = await prisma.order.create({
      data: {
        invoiceNumber,
        cancelToken,
        customerName,
        whatsappNumber,
        address: pickupMethod === 'danus'
          ? `Danus - ${faculty}: ${pickupLocation}`
          : pickupMethod === 'stand_kencana'
            ? STAND_KENCANA_ADDRESS
            : (address || PRODUCTION_ADDRESS),
        pickupMethod,
        pickupDate: new Date(`${selectedPickupDate}T00:00:00+07:00`),
        pickupTime: pickupMethod === 'danus'
          ? DANUS_DELIVERY_TIME
          : pickupMethod === 'stand_kencana'
            ? STAND_KENCANA_TIME
            : null,
        pickupLocation: pickupMethod === 'danus'
          ? pickupLocation
          : pickupMethod === 'stand_kencana'
            ? STAND_KENCANA_ADDRESS
            : PRODUCTION_ADDRESS,
        faculty: pickupMethod === 'danus' ? faculty : null,
        notes: notes || null,
        totalAmount,
        dpAmount,
        items: {
          create: orderItems
        }
      },
      include: orderInclude
    });

    res.status(201).json({ message: 'Pesanan Pre-Order berhasil dibuat!', data: newOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal memproses pesanan', error });
  }
};

// Fitur Mengambil Semua Pesanan (Untuk Admin)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      // PERBAIKAN: Beritahu Prisma untuk menarik relasi antar tabel
      include: orderInclude,
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data pesanan", error });
  }
};

// Fitur Admin Mengubah Status Pesanan
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isOrderStatus(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status pesanan tidak valid.',
        allowedStatuses: ORDER_STATUSES
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: Number(id) },
      data: { status },
      include: orderInclude
    });

    res.status(200).json({ 
      success: true,
      message: "Status pesanan berhasil diperbarui!", 
      data: updatedOrder 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengubah status pesanan", error });
  }
};

// Fitur Menghapus Pesanan Beserta Detail & Pembayarannya (DELETE)
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Hapus detail barangnya dulu (Tabel OrderItem)
    await prisma.orderItem.deleteMany({ where: { orderId: Number(id) } });
    
    // 2. Hapus bukti pembayarannya jika ada (Tabel Payment)
    await prisma.payment.deleteMany({ where: { orderId: Number(id) } });
    
    // 3. Baru hapus Induk Pesanannya (Tabel Order)
    await prisma.order.delete({ where: { id: Number(id) } });

    res.status(200).json({ message: "Pesanan beserta seluruh detailnya berhasil dihapus bersih!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal menghapus pesanan", error });
  }
};

// Fitur Download Struk PDF
export const downloadReceipt = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    // 1. Cari data pesanan beserta item-nya
    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ message: "Pesanan tidak ditemukan!" });
    }

    // 2. Lempar data pesanan ke dapur (Service) untuk dibuatkan PDF
    const pdfBuffer = await buildReceiptPDF(order);

    // 3. Kirim file PDF ke pengguna (browser/Postman)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${order.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal membuat struk PDF", error });
  }
};

export const cancelOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { invoiceNumber } = req.params;
    // Token pembatalan hanya diberikan kepada pemilik pesanan saat order dibuat.
    const { cancelToken } = req.body || {};

    if (!cancelToken || typeof cancelToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Token pembatalan tidak ditemukan. Minta admin untuk membatalkan pesanan.'
      });
    }

    const existingOrder = await prisma.order.findFirst({
      where: { invoiceNumber: String(invoiceNumber) }
    });

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    }

    if (!existingOrder.cancelToken || existingOrder.cancelToken !== cancelToken) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak berhak membatalkan pesanan ini. Minta admin untuk membantu.'
      });
    }

    if (existingOrder.status === 'DIBATALKAN') {
      return res.status(400).json({ success: false, message: 'Pesanan ini sudah dibatalkan sebelumnya.' });
    }

    if (existingOrder.status === 'SELESAI') {
      return res.status(400).json({ success: false, message: 'Pesanan yang sudah selesai tidak dapat dibatalkan.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: existingOrder.id },
      data: { status: 'DIBATALKAN' },
      include: orderInclude
    });

    res.status(200).json({
      success: true,
      message: 'Pesanan berhasil dibatalkan',
      data: updatedOrder
    });
  } catch (error) {
    console.error("Gagal membatalkan pesanan:", error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};
