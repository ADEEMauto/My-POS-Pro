import React from 'react';
import { Sale } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { formatDate } from '../utils/helpers';

interface ReceiptProps {
    sale: Sale;
}

const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(({ sale }, ref) => {
    const { shopInfo, customers, customerTiers } = useAppContext();
    const customer = customers.find(c => c.id === sale.customerId);
    const tier = customer?.tierId ? customerTiers.find(t => t.id === customer.tierId) : null;

    const formatCurrencyForReceipt = (amount: number) => `Rs. ${Math.round(amount).toFixed(2)}`;

    return (
        <div ref={ref} className="p-4 bg-white text-black font-mono text-xs max-w-sm mx-auto">
            <div className="text-center mb-4">
                <h2 className="text-lg font-bold">{shopInfo?.name}</h2>
                <p>{shopInfo?.address}</p>
            </div>
            <hr className="my-2 border-dashed" />
            <p><strong>Receipt ID:</strong> {sale.id}</p>
            <p><strong>Date:</strong> {formatDate(sale.date)}</p>
            <p><strong>Bike No:</strong> {sale.customerId}</p>
            {sale.customerName && <p><strong>Customer:</strong> {sale.customerName}</p>}
            <hr className="my-2 border-dashed" />
            <table className="w-full">
                <thead>
                    <tr>
                        <th className="text-left">Item</th>
                        <th className="text-center">Qty</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((item, index) => (
                        <tr key={`${item.productId}-${index}`}>
                            <td className="text-left align-top">
                                {item.name}
                                {item.discount > 0 && (
                                    <div className="text-xs">
                                        (Disc: -{item.discountType === 'fixed' ? formatCurrencyForReceipt(item.discount) : `${item.discount}%`})
                                    </div>
                                )}
                            </td>
                            <td className="text-center align-top">{item.quantity}</td>
                            <td className="text-right align-top">{formatCurrencyForReceipt(item.originalPrice)}</td>
                            <td className="text-right align-top">{formatCurrencyForReceipt(item.originalPrice * item.quantity)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <hr className="my-2 border-dashed" />
            <div className="space-y-1">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrencyForReceipt(sale.subtotal)}</span>
                </div>
                {sale.totalItemDiscounts > 0 && (
                    <div className="flex justify-between">
                        <span>Item Discounts:</span>
                        <span>-{formatCurrencyForReceipt(sale.totalItemDiscounts)}</span>
                    </div>
                )}
                {sale.overallDiscount > 0 && (
                     <div className="flex justify-between">
                        <span>Overall Discount:</span>
                        <span>-{formatCurrencyForReceipt(sale.subtotal - sale.totalItemDiscounts - (sale.loyaltyDiscount || 0) - sale.total)}</span>
                    </div>
                )}
                {sale.loyaltyDiscount && sale.loyaltyDiscount > 0 && (
                     <div className="flex justify-between">
                        <span>Loyalty Discount:</span>
                        <span>-{formatCurrencyForReceipt(sale.loyaltyDiscount)}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL:</span>
                    <span>{formatCurrencyForReceipt(sale.total)}</span>
                </div>
            </div>

            {(sale.pointsEarned !== undefined) && (
                 <div className="mt-4 pt-2 border-t border-dashed">
                    <h3 className="font-bold text-center mb-1">Loyalty Points Summary</h3>
                    <div className="flex justify-between"><span>Points Earned:</span><span>+{sale.pointsEarned}</span></div>
                    {sale.redeemedPoints && sale.redeemedPoints > 0 && (
                       <div className="flex justify-between"><span>Points Redeemed:</span><span>-{sale.redeemedPoints}</span></div>
                    )}
                    <div className="flex justify-between font-bold"><span>Final Balance:</span><span>{sale.finalLoyaltyPoints}</span></div>
                    {tier && (
                        <p className="text-center mt-2 text-xs">
                            You are a {tier.name} Customer Now. Upgrade your Tier to Earn more Loyalty Points.
                            <br />
                            <strong className="font-bold">More Points... More Discounts !!</strong>
                        </p>
                    )}
                 </div>
            )}
            
            <p className="text-center mt-4 text-xs">Thank you for your purchase!</p>
        </div>
    );
});

export default Receipt;
