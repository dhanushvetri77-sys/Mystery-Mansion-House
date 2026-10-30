import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config={api:{bodyParser:false}};
async function rawBody(req){const chunks=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks);}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).send('Method not allowed');
  let event;
  try{const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);event=stripe.webhooks.constructEvent(await rawBody(req),req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}
  catch(error){console.error('Invalid Stripe webhook:',error.message);return res.status(400).send(`Webhook Error: ${error.message}`);}
  const session=event.data.object,bookingId=session.metadata?.booking_id||session.client_reference_id;
  if(!bookingId)return res.status(200).json({received:true});
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&session.payment_status==='paid'){
    const paymentIntent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
    const {error}=await admin.from('bookings').update({status:'confirmed',payment_status:'paid',stripe_payment_intent_id:paymentIntent||null}).eq('id',bookingId).eq('payment_status','unpaid').eq('status','pending');
    if(error){console.error('Could not confirm paid booking:',error.message);return res.status(500).send('Could not confirm booking');}
  }else if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)){
    const {error}=await admin.from('bookings').update({status:'cancelled'}).eq('id',bookingId).eq('status','pending');
    if(error){console.error('Could not release expired booking:',error.message);return res.status(500).send('Could not release booking');}
  }
  return res.status(200).json({received:true});
}
