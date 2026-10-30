import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!token)return res.status(401).json({error:'Sign in as staff to continue.'});
    const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await supabase.auth.getUser(token);
    if(authError||!user?.email)return res.status(401).json({error:'Your staff session expired.'});
    const {data:membership}=await supabase.from('staff_members').select('email').eq('email',user.email.toLowerCase()).maybeSingle();
    if(!membership)return res.status(403).json({error:'Staff access is required.'});
    const bookingId=req.body?.booking_id;
    if(!bookingId)return res.status(400).json({error:'Missing booking ID.'});
    const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:booking,error:readError}=await admin.from('bookings').select('id,status,payment_status,stripe_checkout_session_id,stripe_payment_intent_id').eq('id',bookingId).maybeSingle();
    if(readError||!booking)return res.status(404).json({error:'Booking not found.'});
    if(booking.status==='cancelled')return res.status(200).json({message:'Booking is already cancelled.'});
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    let intent=booking.stripe_payment_intent_id, paid=booking.payment_status==='paid';
    if(booking.stripe_checkout_session_id){
      const session=await stripe.checkout.sessions.retrieve(booking.stripe_checkout_session_id);
      if(session.payment_status==='paid'){
        paid=true;intent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||intent;
      }else if(session.status==='open'){
        await stripe.checkout.sessions.expire(session.id);
      }
    }
    if(paid&&intent){
      await stripe.refunds.create({payment_intent:intent,metadata:{booking_id:booking.id}},{idempotencyKey:`playfield-refund-${booking.id}`});
    }
    const {error:updateError}=await admin.from('bookings').update({status:'cancelled',payment_status:paid?'refunded':booking.payment_status,stripe_payment_intent_id:intent||null}).eq('id',booking.id);
    if(updateError)throw updateError;
    return res.status(200).json({message:paid?'Booking cancelled and refund submitted.':'Booking cancelled.'});
  }catch(error){console.error('Booking cancellation failed:',error.message);return res.status(500).json({error:'Could not cancel this booking. No cancellation was recorded.'});}
}
