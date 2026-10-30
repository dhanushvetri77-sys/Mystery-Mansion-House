import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!token)return res.status(401).json({error:'Sign in before booking.'});
    const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await supabase.auth.getUser(token);
    if(authError||!user)return res.status(401).json({error:'Your session expired. Sign in again.'});
    const {name,email,phone,room_id,booking_date,booking_time}=req.body||{};
    if(!name||!email||!room_id||!/^\d{4}-\d{2}-\d{2}$/.test(booking_date||'')||!/^\d{2}:\d{2}$/.test(booking_time||''))return res.status(400).json({error:'Complete all required booking details.'});
    if(booking_date<new Date().toISOString().slice(0,10))return res.status(400).json({error:'Choose today or a future date.'});
    const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:room,error:roomError}=await admin.from('rooms').select('id,name,price_cents,currency').eq('id',room_id).eq('is_active',true).maybeSingle();
    if(roomError||!room)return res.status(400).json({error:'That room is not available.'});
    if(!Number.isInteger(room.price_cents)||room.price_cents<=0)return res.status(400).json({error:'This room does not have a price set yet. Please contact the venue.'});
    const {data:booking,error:bookingError}=await admin.from('bookings').insert({user_id:user.id,name:String(name).trim().slice(0,80),email:String(email).trim().slice(0,120),phone:String(phone||'').trim().slice(0,30),room_id,booking_date,booking_time,status:'pending',payment_status:'unpaid',amount_cents:room.price_cents,currency:room.currency}).select('id').single();
    if(bookingError){if(bookingError.code==='23505')return res.status(409).json({error:'That room and time were just booked. Choose another slot.'});throw bookingError;}
    try{
      const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
      const origin=`https://${req.headers.host}`;
      const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],line_items:[{price_data:{currency:room.currency,unit_amount:room.price_cents,product_data:{name:`${room.name} game booking`,description:`${booking_date} at ${booking_time}`}},quantity:1}],customer_email:String(email).trim(),client_reference_id:booking.id,metadata:{booking_id:booking.id,user_id:user.id,room_id:room.id},success_url:`${origin}/customer.html?payment=success`,cancel_url:`${origin}/customer.html?payment=cancelled`,expires_at:Math.floor(Date.now()/1000)+30*60});
      await admin.from('bookings').update({stripe_checkout_session_id:session.id}).eq('id',booking.id);
      return res.status(200).json({url:session.url});
    }catch(error){await admin.from('bookings').update({status:'cancelled'}).eq('id',booking.id);throw error;}
  }catch(error){console.error('Checkout creation failed:',error.message);return res.status(500).json({error:'Could not start secure checkout. Please try again.'});}
}
