import accountModel from '../models/account.model.js';


export async function createAccountController(req,res) {
  const user = req.user;

  const account = await accountModel.create({
    user:user._id
  })

  res.status(201).json({
    account
  })

}

export async function getUserAccountController(req,res) {
  const accounts = await accountModel.find({user:req.user._id});

  res.status(200).json({
    accounts
  })
}


export async function getAccountBalanceController(req,res) {
    const { accountId } = req.params;

    console.log(accountId)
    const account =  await accountModel.findOne({
        _id:accountId,
        user:req.user._id
    })

    console.log("Logged in user:",req.user.name);

    const newaccount = await accountModel.findById(accountId);
    console.log("Account owner:",newaccount.user.name,newaccount.user._id);


    if(!account) {
      console.log("entered account not found block")
        return res.status(404).json({
            message:"Account not found"
        })
    }

    console.log("continuing after account check")

    const balance = await account.getBalance();
    console.log(balance)

    res.status(200).json({
        accountId:account._id,
        balance:balance
    })
}



