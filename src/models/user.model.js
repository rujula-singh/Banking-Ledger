import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';


const userSchema =new mongoose.Schema({
  email:{
    type:String,
    required:[true, "Email is required for creating a user"],
    trim:true,
    lowercase:true,
    match:[ /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Invalid Email Address"
    ],
    unique:[true, "Email already exists"]
  },
  name: {
    type:String,
    required:[true,"Name is required for creating account"],
  },
  password:{
    type:String,
    required:[true, "Password is required for creating account"],
    minlength:[6,"password should contain more than 6 characters"],
    select:false
  },
  systemUser:{
    type:Boolean,
    default:false,
    immutable:true,
    select:false
  }
}, {
  timestamps:true
})

userSchema.pre("save",async function() {
    
    if(!this.isModified("password")) {
      return;
    }

    const hash = await bcryptjs.hash(this.password,10);
    this.password = hash;
})

userSchema.methods.comparePassword = async function(password) {
  console.log(password,this.password)
  return await bcryptjs.compare(password, this.password);
}

const userModel = mongoose.model("user",userSchema);
export default userModel;